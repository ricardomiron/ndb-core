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

import {Component, OnDestroy, OnInit, ViewContainerRef} from '@angular/core';
import { SessionService } from '../../session/session.service';
import {AppConfig} from '../../app-config/app-config';
import {Title} from '@angular/platform-browser';
import {ObservableMedia, MediaChange} from "@angular/flex-layout";
import {Subscription} from "rxjs";

@Component({
  moduleId: module.id,
  selector: 'app-ui',
  templateUrl: './ui.component.html',
  styleUrls: ['./ui.component.css']
})
export class UiComponent implements OnInit, OnDestroy {

  title: string;
  showNav = true;
  viewContainerRef: ViewContainerRef;
  watcher: Subscription;
  sideNavMode: string;

  constructor(private _sessionService: SessionService,
              viewContainerRef: ViewContainerRef,
              private titleService: Title,
              media:ObservableMedia) {
    this.viewContainerRef = viewContainerRef;
    // watch screen width to change sidenav mode
    this.watcher = media.subscribe((change: MediaChange) => {
      this.sideNavMode = change.mqAlias == 'xs' ? 'over' : 'side';
      if (change.mqAlias != 'xs') {
        this.showNav = true;
      }
    });
  }
  ngOnInit(): void {
    this.title = AppConfig.settings.site_name;
    this.titleService.setTitle(this.title);

    if (window.innerWidth < 600) {
      this.showNav = false;
    }
  }

  ngOnDestroy() {
    this.watcher.unsubscribe();
  }

  isLoggedIn() {
    return this._sessionService.isLoggedIn();
  }

  logout() {
    this._sessionService.logout();
  }
}
