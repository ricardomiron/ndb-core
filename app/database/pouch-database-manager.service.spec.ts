import { PouchDatabaseManagerService } from "./pouch-database-manager.service";

describe('pouch-database-manager tests', () => {
    let dbManager: PouchDatabaseManagerService;
    let testConfigService;

    beforeEach(() => {
        testConfigService = {
            database: {
                name: "unit-test",
                remote_url: "remote-",
                timeout: 60000,
                outdated_threshold_days: 0
            }
        };

        dbManager = new PouchDatabaseManagerService(testConfigService);
    });

    it('returns database', function () {
        let db = dbManager.getDatabase();
        expect(db).toBeDefined();
    });
});
