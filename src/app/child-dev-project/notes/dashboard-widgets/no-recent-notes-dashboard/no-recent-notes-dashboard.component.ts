import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
} from "@angular/core";
import { ChildrenService } from "../../../children/children.service";
import moment from "moment";
import { MatTableDataSource } from "@angular/material/table";
import { MatSort } from "@angular/material/sort";
import { MatPaginator } from "@angular/material/paginator";
import { OnInitDynamicComponent } from "../../../../core/view/dynamic-components/on-init-dynamic-component.interface";

/**
 * Dashboard Widget displaying children that do not have a recently added Note.
 *
 * If you do not set "sinceDays" of "fromBeginningOfWeek" inputs
 * by default notes since beginning of the current week are considered.
 */
@Component({
  selector: "app-no-recent-notes-dashboard",
  templateUrl: "./no-recent-notes-dashboard.component.html",
  styleUrls: ["./no-recent-notes-dashboard.component.scss"],
})
export class NoRecentNotesDashboardComponent
  implements OnInitDynamicComponent, OnInit, AfterViewInit {
  /**
   * number of days since last note that children should be considered having a "recent" note.
   */
  @Input() sinceDays: number = 0;

  /** Whether an additional offset should be automatically added to include notes from the beginning of the week */
  @Input() fromBeginningOfWeek = true;

  /** true while data is not ready/available yet */
  isLoading: boolean;

  /** children displayed in the template
   * Child entities with additional "daysSinceLastNote" field
   */
  concernedChildren: ChildWithRecentNoteInfo[] = [];

  columnsToDisplay: string[] = ["name", "daysSinceLastNote"];
  childrenWithNoteInfoDataSource: MatTableDataSource<ChildWithRecentNoteInfo> = new MatTableDataSource<ChildWithRecentNoteInfo>();
  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;

  constructor(private childrenService: ChildrenService) {}

  onInitFromDynamicConfig(config: any) {
    if (config?.sinceDays) {
      this.sinceDays = config.sinceDays;
    }
    if (config?.fromBeginningOfWeek) {
      this.fromBeginningOfWeek = config.fromBeginningOfWeek;
    }
  }

  async ngOnInit() {
    await this.loadConcernedChildrenFromIndex();
    this.childrenWithNoteInfoDataSource.data = this.concernedChildren;
  }

  ngAfterViewInit() {
    this.childrenWithNoteInfoDataSource.sort = this.sort;
    this.childrenWithNoteInfoDataSource.paginator = this.paginator;
  }

  private async loadConcernedChildrenFromIndex() {
    this.isLoading = true;

    let dayRangeBoundary = this.sinceDays;
    if (this.fromBeginningOfWeek) {
      dayRangeBoundary += moment().diff(moment().startOf("week"), "days");
    }
    const queryRange = Math.round((dayRangeBoundary * 3) / 10) * 10; // query longer range to be able to display exact date of last note for recent

    this.concernedChildren = Array.from(
      await this.childrenService.getDaysSinceLastNoteOfEachChild(queryRange)
    )
      .filter((stat) => stat[1] >= dayRangeBoundary)
      .map((stat) => statsToChildWithRecentNoteInfo(stat, queryRange))
      .sort((a, b) => b.daysSinceLastNote - a.daysSinceLastNote);

    this.isLoading = false;
  }

  get tootltip(): string {
    // unfortunately the only way this works w/ localization
    if (this.fromBeginningOfWeek && this.sinceDays > 0) {
      return $localize`includes children without a note since the beginning of the week within the last ${this.sinceDays} days`;
    } else if (this.fromBeginningOfWeek && !(this.sinceDays > 0)) {
      return $localize`includes children without a note since the beginning of the week`;
    } else if (!this.fromBeginningOfWeek && this.sinceDays > 0) {
      return $localize`includes children without a note within the last ${this.sinceDays} days`;
    } else {
      return $localize`includes children without a note`;
    }
  }
}

/**
 * details on child stats to be displayed
 */
interface ChildWithRecentNoteInfo {
  childId: string;
  daysSinceLastNote: number;
  /** true when the daysSinceLastNote is not accurate but was cut off for performance optimization */
  moreThanDaysSince: boolean;
}

/**
 * Map a result entry from getDaysSinceLastNoteOfEachChild to the ChildWithRecentNoteInfo interface
 * @param stat Array of [childId, daysSinceLastNote]
 * @param queryRange The query range (the maximum of days that exactly calculated)
 */
function statsToChildWithRecentNoteInfo(
  stat: [string, number],
  queryRange: number
): ChildWithRecentNoteInfo {
  if (stat[1] < Number.POSITIVE_INFINITY) {
    return {
      childId: stat[0],
      daysSinceLastNote: stat[1],
      moreThanDaysSince: false,
    };
  } else {
    return {
      childId: stat[0],
      daysSinceLastNote: queryRange,
      moreThanDaysSince: true,
    };
  }
}
