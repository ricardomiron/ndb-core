/*
 *     This file is part of ndb-core.
 *
 *     ndb-core is free software: you can redistribute it and/or modify
 *     it under the terms of the GNU General Public License as published by
 *     the Free Software Foundation, either version 3 of the License, or
 *     (at your option) any later version.
 *
 *     ndb-core is distributed in the hope that it will be useful,
 *     but WITHOUT ANY WARRANTY; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *     GNU General Public License for more details.
 *
 *     You should have received a copy of the GNU General Public License
 *     along with ndb-core.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Database, GetAllOptions, GetOptions, QueryOptions } from "./database";
import { Logging } from "../logging/logging.service";
import PouchDB from "pouchdb-browser";
import memory from "pouchdb-adapter-memory";
import { PerformanceAnalysisLogging } from "../../utils/performance-analysis-logging";
import { Injectable, Optional } from "@angular/core";
import { firstValueFrom, Observable, Subject } from "rxjs";
import { filter } from "rxjs/operators";
import { HttpStatusCode } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import { KeycloakAuthService } from "../session/auth/keycloak/keycloak-auth.service";

/**
 * Wrapper for a PouchDB instance to decouple the code from
 * that external library.
 *
 * Additional convenience functions on top of the PouchDB API
 * should be implemented in the abstract {@link Database}.
 */
@Injectable()
export class PouchDatabase extends Database {
  /**
   * Small helper function which creates a database with in-memory PouchDB initialized
   */
  static create(): PouchDatabase {
    return new PouchDatabase().initInMemoryDB();
  }

  /**
   * The reference to the PouchDB instance
   * @private
   */
  private pouchDB: PouchDB.Database;

  /**
   * A list of promises that resolve once all the (until now saved) indexes are created
   * @private
   */
  private indexPromises: Promise<any>[] = [];

  /**
   * An observable that emits a value whenever the PouchDB receives a new change.
   * This change can come from the current user or remotely from the (live) synchronization
   * @private
   */
  private changesFeed: Subject<any>;

  private databaseInitialized = new Subject<void>();

  /**
   * Create a PouchDB database manager.
   */
  constructor(@Optional() private authService?: KeycloakAuthService) {
    super();
  }

  /**
   * Initialize the PouchDB with the in-memory adapter.
   * See {@link https://github.com/pouchdb/pouchdb/tree/master/packages/node_modules/pouchdb-adapter-memory}
   * @param dbName the name for the database
   */
  initInMemoryDB(dbName = "in-memory-database"): PouchDatabase {
    PouchDB.plugin(memory);
    this.pouchDB = new PouchDB(dbName, { adapter: "memory" });
    this.databaseInitialized.complete();
    return this;
  }

  /**
   * Initialize the PouchDB with the IndexedDB/in-browser adapter (default).
   * See {link https://github.com/pouchdb/pouchdb/tree/master/packages/node_modules/pouchdb-browser}
   * @param dbName the name for the database under which the IndexedDB entries will be created
   * @param options PouchDB options which are directly passed to the constructor
   */
  initIndexedDB(
    dbName = "indexed-database",
    options?: PouchDB.Configuration.DatabaseConfiguration,
  ): PouchDatabase {
    this.pouchDB = new PouchDB(dbName, options);
    this.databaseInitialized.complete();
    return this;
  }

  /**
   * Initializes the PouchDB with the http adapter to directly access a remote CouchDB without replication
   * See {@link https://pouchdb.com/adapters.html#pouchdb_over_http}
   * @param dbName (relative) path to the remote database
   * @param fetch a overwrite for the default fetch handler
   */
  initRemoteDB(
    dbName = `${environment.DB_PROXY_PREFIX}/${environment.DB_NAME}`,
  ): PouchDatabase {
    const options = {
      adapter: "http",
      skip_setup: true,
      fetch: (url: string | Request, opts: RequestInit) =>
        this.defaultFetch(url, opts),
    };
    this.pouchDB = new PouchDB(dbName, options);
    this.databaseInitialized.complete();
    return this;
  }

  private defaultFetch: Fetch = async (url: string | Request, opts: any) => {
    if (typeof url !== "string") {
      const err = new Error("PouchDatabase.fetch: url is not a string");
      err["details"] = url;
      throw err;
    }

    const remoteUrl =
      environment.DB_PROXY_PREFIX + url.split(environment.DB_PROXY_PREFIX)[1];
    this.authService.addAuthHeader(opts.headers);

    let result: Response;
    try {
      result = await PouchDB.fetch(remoteUrl, opts);
    } catch (err) {
      Logging.debug("navigator.onLine", navigator.onLine);
      Logging.warn("Failed to fetch from DB", err);
    }

    // retry login if request failed with unauthorized
    if (!result || result.status === HttpStatusCode.Unauthorized) {
      try {
        await this.authService.login();
        this.authService.addAuthHeader(opts.headers);
        result = await PouchDB.fetch(remoteUrl, opts);
      } catch (err) {
        Logging.debug("navigator.onLine", navigator.onLine);
        Logging.warn("Failed to fetch from DB", err);
      }
    }

    if (!result || result.status >= 500) {
      Logging.debug("Actual DB Fetch response", result);
      Logging.debug("navigator.onLine", navigator.onLine);
      throw new DatabaseException({
        error: "Failed to fetch from DB",
        actualResponse: JSON.stringify(result.headers),
        actualResponseBody: await result?.text(),
      });
    }
    return result;
  };

  async getPouchDBOnceReady(): Promise<PouchDB.Database> {
    await firstValueFrom(this.databaseInitialized, {
      defaultValue: this.pouchDB,
    });
    return this.pouchDB;
  }

  /**
   * Get the actual instance of the PouchDB
   */
  getPouchDB(): PouchDB.Database {
    return this.pouchDB;
  }

  /**
   * Load a single document by id from the database.
   * (see {@link Database})
   * @param id The primary key of the document to be loaded
   * @param options Optional PouchDB options for the request
   * @param returnUndefined (Optional) return undefined instead of throwing error if doc is not found in database
   */
  async get(
    id: string,
    options: GetOptions = {},
    returnUndefined?: boolean,
  ): Promise<any> {
    try {
      return await (await this.getPouchDBOnceReady()).get(id, options);
    } catch (err) {
      if (err.status === 404) {
        Logging.debug("Doc not found in database: " + id);
        if (returnUndefined) {
          return undefined;
        }
      }

      throw new DatabaseException(err, id);
    }
  }

  /**
   * Load all documents (matching the given PouchDB options) from the database.
   * (see {@link Database})
   *
   * Normally you should rather use "getAll()" or another well typed method of this class
   * instead of passing PouchDB specific options here
   * because that will make your code tightly coupled with PouchDB rather than any other database provider.
   *
   * @param options PouchDB options object as in the normal PouchDB library
   */
  async allDocs(options?: GetAllOptions) {
    try {
      const result = await (await this.getPouchDBOnceReady()).allDocs(options);
      return result.rows.map((row) => row.doc);
    } catch (err) {
      throw new DatabaseException(
        err,
        "allDocs; startkey: " + options?.["startkey"],
      );
    }
  }

  /**
   * Save a document to the database.
   * (see {@link Database})
   *
   * @param object The document to be saved
   * @param forceOverwrite (Optional) Whether conflicts should be ignored and an existing conflicting document forcefully overwritten.
   */
  async put(object: any, forceOverwrite = false): Promise<any> {
    if (forceOverwrite) {
      object._rev = undefined;
    }

    try {
      return await (await this.getPouchDBOnceReady()).put(object);
    } catch (err) {
      if (err.status === 409) {
        return this.resolveConflict(object, forceOverwrite, err);
      } else {
        throw new DatabaseException(err, object._id);
      }
    }
  }

  /**
   * Save an array of documents to the database
   * @param objects the documents to be saved
   * @param forceOverwrite whether conflicting versions should be overwritten
   * @returns array with the result for each object to be saved, if any item fails to be saved, this returns a rejected Promise.
   *          The save can partially fail and return a mix of success and error states in the array (e.g. `[{ ok: true, ... }, { error: true, ... }]`)
   */
  async putAll(objects: any[], forceOverwrite = false): Promise<any> {
    if (forceOverwrite) {
      objects.forEach((obj) => (obj._rev = undefined));
    }

    const pouchDB = await this.getPouchDBOnceReady();
    const results = await pouchDB.bulkDocs(objects);

    for (let i = 0; i < results.length; i++) {
      // Check if document update conflicts happened in the request
      const result = results[i] as PouchDB.Core.Error;
      if (result.status === 409) {
        results[i] = await this.resolveConflict(
          objects.find((obj) => obj._id === result.id),
          forceOverwrite,
          result,
        ).catch((e) => {
          Logging.warn(
            "error during putAll",
            e,
            objects.map((x) => x._id),
          );
          return new DatabaseException(e);
        });
      }
    }

    if (results.some((r) => r instanceof Error)) {
      return Promise.reject(results);
    }
    return results;
  }

  /**
   * Delete a document from the database
   * (see {@link Database})
   *
   * @param object The document to be deleted (usually this object must at least contain the _id and _rev)
   */
  remove(object: any) {
    return this.getPouchDBOnceReady()
      .then((pouchDB) => pouchDB.remove(object))
      .catch((err) => {
        throw new DatabaseException(err, object["_id"]);
      });
  }

  /**
   * Check if a database is new/empty.
   * Returns true if there are no documents in the database
   */
  isEmpty(): Promise<boolean> {
    return this.getPouchDBOnceReady()
      .then((pouchDB) => pouchDB.info())
      .then((res) => res.doc_count === 0);
  }

  /**
   * Listen to changes to documents which have an _id with the given prefix
   * @param prefix for which document changes are emitted
   * @returns observable which emits the filtered changes
   */
  changes(prefix: string): Observable<any> {
    if (!this.changesFeed) {
      this.changesFeed = new Subject();
      this.subscribeChanges();
    }
    return this.changesFeed.pipe(filter((doc) => doc._id.startsWith(prefix)));
  }

  private async subscribeChanges() {
    (await this.getPouchDBOnceReady())
      .changes({
        live: true,
        since: "now",
        include_docs: true,
      })
      .addListener("change", (change) => this.changesFeed.next(change.doc))
      .catch((err) => {
        if (
          err.statusCode === HttpStatusCode.Unauthorized ||
          err.statusCode === HttpStatusCode.GatewayTimeout
        ) {
          Logging.warn(err);
        } else {
          Logging.error(err);
        }

        // retry
        setTimeout(() => this.subscribeChanges(), 10000);
      });
  }

  /**
   * Destroy the database and all saved data
   */
  async destroy(): Promise<any> {
    await Promise.all(this.indexPromises);
    if (this.pouchDB) {
      return this.pouchDB.destroy();
    }
  }

  /**
   * Reset the database state so a new one can be opened.
   */
  reset() {
    this.pouchDB = undefined;
    this.changesFeed = undefined;
    this.databaseInitialized = new Subject();
  }

  /**
   * Query data from the database based on a more complex, indexed request.
   * (see {@link Database})
   *
   * This is directly calling the PouchDB implementation of this function.
   * Also see the documentation there: {@link https://pouchdb.com/api.html#query_database}
   *
   * @param fun The name of a previously saved database index
   * @param options Additional options for the query, like a `key`. See the PouchDB docs for details.
   */
  query(
    fun: string | ((doc: any, emit: any) => void),
    options: QueryOptions,
  ): Promise<any> {
    return this.getPouchDBOnceReady()
      .then((pouchDB) => pouchDB.query(fun, options))
      .catch((err) => {
        throw new DatabaseException(
          err,
          typeof fun === "string" ? fun : undefined,
        );
      });
  }

  /**
   * Create a database index to `query()` certain data more efficiently in the future.
   * (see {@link Database})
   *
   * Also see the PouchDB documentation regarding indices and queries: {@link https://pouchdb.com/api.html#query_database}
   *
   * @param designDoc The PouchDB style design document for the map/reduce query
   */
  saveDatabaseIndex(designDoc: any): Promise<void> {
    const creationPromise = this.createOrUpdateDesignDoc(designDoc);
    this.indexPromises.push(creationPromise);
    return creationPromise;
  }

  private async createOrUpdateDesignDoc(designDoc): Promise<void> {
    const existingDesignDoc = await this.get(designDoc._id, {}, true);
    if (!existingDesignDoc) {
      Logging.debug("creating new database index");
    } else if (
      JSON.stringify(existingDesignDoc.views) !==
      JSON.stringify(designDoc.views)
    ) {
      Logging.debug("replacing existing database index");
      designDoc._rev = existingDesignDoc._rev;
    } else {
      // already up to date, nothing more to do
      return;
    }

    await this.put(designDoc, true);
    await this.prebuildViewsOfDesignDoc(designDoc);
  }

  @PerformanceAnalysisLogging
  private async prebuildViewsOfDesignDoc(designDoc: any): Promise<void> {
    for (const viewName of Object.keys(designDoc.views)) {
      const queryName = designDoc._id.replace(/_design\//, "") + "/" + viewName;
      await this.query(queryName, { key: "1" });
    }
  }

  /**
   * Attempt to intelligently resolve conflicting document versions automatically.
   * @param newObject
   * @param overwriteChanges
   * @param existingError
   */
  private async resolveConflict(
    newObject: any,
    overwriteChanges = false,
    existingError: any = {},
  ): Promise<any> {
    const existingObject = await this.get(newObject._id);
    const resolvedObject = this.mergeObjects(existingObject, newObject);
    if (resolvedObject) {
      Logging.debug(
        "resolved document conflict automatically (" + resolvedObject._id + ")",
      );
      return this.put(resolvedObject);
    } else if (overwriteChanges) {
      Logging.debug(
        "overwriting conflicting document version (" + newObject._id + ")",
      );
      newObject._rev = existingObject._rev;
      return this.put(newObject);
    } else {
      existingError.message = `${
        existingError.message
      } (unable to resolve) ID: ${JSON.stringify(newObject)}`;
      throw new DatabaseException(existingError);
    }
  }

  private mergeObjects(_existingObject: any, _newObject: any) {
    // TODO: implement automatic merging of conflicting entity versions
    return undefined;
  }
}

/**
 * This overwrites PouchDB's error class which only logs limited information
 */
class DatabaseException extends Error {
  constructor(
    error: PouchDB.Core.Error | { [key: string]: any },
    entityId?: string,
  ) {
    super();

    if (entityId) {
      error["entityId"] = entityId;
    }
    Object.assign(this, error);
  }
}
