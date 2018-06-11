import { Injectable } from '@angular/core';
import {Observable} from 'rxjs/Rx';
import {Child} from './child';
import {EntityMapperService} from '../entity/entity-mapper.service';
import {AttendanceMonth} from './attendance/attendance-month';
import {Database} from '../database/database';
import {Note} from './notes/note';

@Injectable()
export class ChildrenService {
  attendanceIndicesUpdated: Promise<any>;

  constructor(private entityMapper: EntityMapperService,
              private db: Database) {
    this.attendanceIndicesUpdated = this.createAttendanceAnalysisIndex();
    this.createNotesIndex();
  }

  getChildren(): Observable<Child[]> {
    return Observable.fromPromise(this.entityMapper.loadType<Child>(Child));
  }

  getChild(id: string): Observable<Child> {
    return Observable.fromPromise(this.entityMapper.load<Child>(Child, id));
  }


  getAttendances(): Observable<AttendanceMonth[]> {
    return Observable.fromPromise(this.entityMapper.loadType<AttendanceMonth>(AttendanceMonth));
  }

  getAttendancesOfChild(childId: string): Observable<AttendanceMonth[]> {
    return Observable.fromPromise(
      this.entityMapper.loadType<AttendanceMonth>(AttendanceMonth)
        .then(loadedEntities => {
          return loadedEntities.filter(o => o.student === childId);
        })
    );
  }


  queryAttendanceLast3Months() {
    return this.attendanceIndicesUpdated
      .then(() => this.db.query('avg_attendance_index/three_months', {reduce: true, group: true}));
  }

  queryAttendanceLastMonth() {
    return this.attendanceIndicesUpdated
      .then(() => this.db.query('avg_attendance_index/last_month', {reduce: true, group: true}))
  }


  private createAttendanceAnalysisIndex(): Promise<any> {
    const designDoc = {
      _id: '_design/avg_attendance_index',
      views: {
        three_months: {
          map: this.getAverageAttendanceMapFunction(),
          reduce: '_stats'
        },
        last_month: {
          map: this.getLastAverageAttendanceMapFunction(),
          reduce: '_stats'
        }
      }
    };

    return this.db.saveDatabaseIndex(designDoc);
  }


  private getAverageAttendanceMapFunction () {
    return '(doc) => {' +
      'if (!doc._id.startsWith("AttendanceMonth:") ) { return; }' +
      'if (!isWithinLast3Months(new Date(doc.month), new Date())) { return; }' +
      'var attendance = (doc.daysAttended / (doc.daysWorking - doc.daysExcused));' +
      'if (!isNaN(attendance)) { emit(doc.student, attendance); }' +
      'function isWithinLast3Months(date, now) {' +
      '  let months;' +
      '  months = (now.getFullYear() - date.getFullYear()) * 12;' +
      '  months -= date.getMonth();' +
      '  months += now.getMonth();' +
      '  if (months < 0) { return false; }' +
      '  return months <= 3;' +
      '}' +
      '}';
  }

  private getLastAverageAttendanceMapFunction () {
    return '(doc) => {' +
      'if (!doc._id.startsWith("AttendanceMonth:")) { return; }' +
      'if (!isWithinLastMonth(new Date(doc.month), new Date())) { return; }' +
      'var attendance = (doc.daysAttended / (doc.daysWorking - doc.daysExcused));' +
      'if (!isNaN(attendance)) { emit(doc.student, attendance); }' +
      'function isWithinLastMonth(date, now) {' +
      '  let months;' +
      '  months = (now.getFullYear() - date.getFullYear()) * 12;' +
      '  months -= date.getMonth();' +
      '  months += now.getMonth();' +
      '  return months === 1;' +
      '}' +
      '}';
  }





  getNotesOfChild(childId: string): Observable<Note[]> {
    const promise = this.db.query('notes_index/by_child', {key: childId, include_docs: true})
      .then(loadedEntities => {
        return loadedEntities.rows.map(loadedRecord => {
          let entity = new Note('');
          entity = Object.assign(entity, loadedRecord.doc);
          return entity;
        });
      });

    return Observable.fromPromise(promise);
  }

  private createNotesIndex(): Promise<any> {
    const designDoc = {
      _id: '_design/notes_index',
      views: {
        by_child: {
          map: '(doc) => { doc.children.forEach(childId => emit(childId)); }'
        }
      }
    };

    return this.db.saveDatabaseIndex(designDoc);
  }

}
