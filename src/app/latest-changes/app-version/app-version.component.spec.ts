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

import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AppVersionComponent } from './app-version.component';
import {MatDialog, MatDialogModule} from '@angular/material';
import {SessionService} from '../../session/session.service';
import {EntityMapperService} from '../../entity/entity-mapper.service';
import {LatestChangesService} from '../latest-changes.service';
import {Observable} from 'rxjs/Rx';
import {SessionStatus} from '../../session/session-status';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {ChangelogComponent} from '../changelog/changelog.component';
import {NgModule} from '@angular/core';
import {AppConfig} from '../../app-config/app-config';


@NgModule({
  declarations: [ChangelogComponent],
  imports: [MatDialogModule, NoopAnimationsModule],
  entryComponents: [ChangelogComponent],
})
class TestModule { }

describe('AppVersionComponent', () => {
  let component: AppVersionComponent;
  let fixture: ComponentFixture<AppVersionComponent>;

  let latestChangesService: LatestChangesService;
  let sessionService: SessionService;
  let entityMapper: EntityMapperService;

  beforeEach(async(() => {
    latestChangesService = new LatestChangesService(null, null);
    sessionService = new SessionService(null, null, null);
    entityMapper = new EntityMapperService(null);
    AppConfig.settings = {
      version: '2.0.1',
      site_name: '',
      database: { name: 'unit-tests', remote_url: '', timeout: 60000, outdated_threshold_days: 0 },
      dev: { useRemoteDatabaseDuringDevelopment: true }
    };

    spyOn(latestChangesService, 'getChangelog').and
      .returnValue(Observable.of([{ name: 'test', tag_name: 'v1.0', body: 'latest test', published_at: '2018-01-01'}]));
    spyOn(sessionService, 'onSessionStatusChanged').and
      .returnValue(Observable.of(SessionStatus.loggedIn));

    TestBed.configureTestingModule({
      declarations: [AppVersionComponent],
      imports: [TestModule,
        MatDialogModule, NoopAnimationsModule],
      providers: [
        {provide: SessionService, useValue: sessionService},
        {provide: EntityMapperService, useValue: entityMapper},
        {provide: LatestChangesService, useValue: latestChangesService},
      ]
    })
      .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AppVersionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });


  it('should be created', () => {
    expect(component).toBeTruthy();
  });


  it('should open dialog', () => {
    const dialogService = fixture.debugElement.injector.get(MatDialog);
    const spy = spyOn(dialogService, 'open').and.callThrough();

    component.showLatestChanges();
    expect(spy.calls.count()).toBe(1, 'dialog not opened');
  });

});
