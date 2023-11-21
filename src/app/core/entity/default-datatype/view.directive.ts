import { Entity } from "../model/entity";
import { Directive, Input, OnChanges } from "@angular/core";

@Directive()
export abstract class ViewDirective<T, C = any> implements OnChanges {
  @Input() entity: Entity;
  @Input() id: string;
  @Input() tooltip: string;
  @Input() value: T;
  @Input() config: C;

  /** indicating that the value is not in its original state, so that components can explain this to the user */
  isPartiallyAnonymized: boolean;

  ngOnChanges() {
    this.isPartiallyAnonymized =
      this.entity?.anonymized &&
      this.entity?.getSchema()?.get(this.id)?.anonymize === "retain-anonymized";
  }
}
