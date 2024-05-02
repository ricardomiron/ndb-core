import { Entity } from "../../entity/model/entity";
import { DateRangeFilterConfigOption } from "../../entity-list/EntityListConfig";
import { DateRange } from "@angular/material/datepicker";
import { calculateDateRange } from "../../basic-datatypes/date/date-range-filter/date-range-filter-panel/date-range-filter-panel.component";
import moment from "moment";
import { DataFilter, Filter } from "./filters";
import { isValidDate } from "../../../utils/utils";
import { DateRangeFilterComponent } from "../../basic-datatypes/date/date-range-filter/date-range-filter.component";
import { NumberRangeFilterComponent } from "app/core/basic-datatypes/number/number-range-filter/number-range-filter.component";

/**
 * Represents a filter for number values.
 */
export class NumberFilter<T extends Entity> extends Filter<T> {
  override component = NumberRangeFilterComponent;

  constructor(
    public name: string,
    public label: string = name,
    // public rangeOptions: DateRangeFilterConfigOption[],
  ) {
    super(name, label);
    // this.selectedOptionValues = [];
  }

  /**
   * Returns the date range according to the selected option or dates
   */
  // getDateRange(): DateRange<Date> {
  //   const selectedOption = this.getSelectedOption();
  //   if (selectedOption) {
  //     return calculateDateRange(selectedOption);
  //   }
  //   const dates = this.selectedOptionValues;
  //   if (dates?.length == 2) {
  //     return this.getDateRangeFromDateStrings(dates[0], dates[1]);
  //   }
  //   return new DateRange(undefined, undefined);
  // }

  getFilter(): DataFilter<T> {
    // const range = this.getDateRange();
    const filterObject: { $gte?: string; $lte?: string } = {};
    if (this.selectedOptionValues[0]) {
      filterObject.$gte = this.selectedOptionValues[0];
    }
    if (this.selectedOptionValues[1]) {
      filterObject.$lte = this.selectedOptionValues[1];
    }
    if (filterObject.$gte || filterObject.$lte) {
      return {
        [this.name]: filterObject,
      } as DataFilter<T>;
    }
    return {} as DataFilter<T>;
  }

  // getSelectedOption() {
  //   return this.rangeOptions[this.selectedOptionValues as any];
  // }

  // private getDateRangeFromDateStrings(
  //   dateStr1: string,
  //   dateStr2: string,
  // ): DateRange<Date> {
  //   const date1 = moment(dateStr1).toDate();
  //   const date2 = moment(dateStr2).toDate();

  //   return new DateRange(
  //     isValidDate(date1) ? date1 : undefined,
  //     isValidDate(date2) ? date2 : undefined,
  //   );
  // }
}