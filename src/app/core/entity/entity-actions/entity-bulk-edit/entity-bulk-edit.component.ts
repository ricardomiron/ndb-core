import { Component, Inject, OnInit } from "@angular/core";
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatButtonModule } from "@angular/material/button";
import { DialogCloseComponent } from "app/core/common-components/dialog-close/dialog-close.component";
import { MatInputModule } from "@angular/material/input";
import { ErrorHintComponent } from "app/core/common-components/error-hint/error-hint.component";
import { EntityFieldEditComponent } from "app/core/common-components/entity-field-edit/entity-field-edit.component";
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { MatTooltipModule } from "@angular/material/tooltip";
import { FormFieldConfig } from "app/core/common-components/entity-form/FormConfig";
import { Entity, EntityConstructor } from "../../model/entity";
import { MatOption } from "@angular/material/core";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatSelectModule } from "@angular/material/select";
import { CommonModule } from "@angular/common";
import { EntityForm, EntityFormService } from "app/core/common-components/entity-form/entity-form.service";

@Component({
  selector: "app-entity-bulk-edit",
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    DialogCloseComponent,
    MatInputModule,
    ErrorHintComponent,
    FormsModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    MatTooltipModule,
    MatOption,
    MatFormFieldModule,
    MatSelectModule,
    CommonModule,
    EntityFieldEditComponent,
  ],
  templateUrl: "./entity-bulk-edit.component.html",
  styleUrl: "./entity-bulk-edit.component.scss",
})
export class EntityBulkEditComponent<E extends Entity> implements OnInit {
  formField: FormFieldConfig;
  schemaFieldsForm: FormGroup;
  entityConstructor: EntityConstructor;
  selectedRows: any;
  entityData: any;
  showDynamicFields: boolean = false;
  _field: FormFieldConfig;
  form: EntityForm<E> | undefined;

  entityFields: Array<{ key: string; label: string; field: any }> = [];

  constructor(
    @Inject(MAT_DIALOG_DATA)
    data: {
      selectedRow: any;
      entityConstructor: EntityConstructor;
    },
    private dialogRef: MatDialogRef<any>,
    private fb: FormBuilder,
    private entityFormService: EntityFormService,
  ) {
    this.entityConstructor = data.entityConstructor;
    this.entityData = data.selectedRow[0];
    this.selectedRows = data.selectedRow.length;
  }

  ngOnInit(): void {
    this.init();
  }

  private init() {
    this.initForm();
    this.fetchEntityFieldsData();
  }

  private initForm() {
    this.schemaFieldsForm = this.fb.group({
      selectedField: ["", Validators.required],
    });
  }

  fetchEntityFieldsData() {
    this.entityFields = Array.from(this.entityConstructor.schema.entries())
      .filter(([key, field]) => field.label)
      .map(([key, field]) => ({
        key: key,
        label: field.label,
        field: field,
      }));
    console.log(this.entityFields, "entityFields");
  }

  onChangeProperty(fieldId: string) {
    // console.log(this.entityData, "this.entityData");

    this._field = this.entityFormService.extendFormFieldConfig(
      fieldId,
      this.entityData.getConstructor(),
    );
    if (this._field) {
      // Call the method to fetch entity fields data (assuming it's done somewhere in your flow)
      this.fetchEntityFieldsData(); 

      // Extract the 'field' properties from the populated 'entityFields'
      const fieldObjects = this.entityFields.map(item => item.key); 
      // console.log(fieldObjects, "fieldObjects");

      // Pass the field objects into the form creation method
      this.entityFormService
        .createEntityForm(
          fieldObjects,  // Use the extracted field objects
          this.entityData,
        )
        .then((value) => {
          this.form = value;
          // console.log(this.form, "parentformmm");
        });

      this.showDynamicFields = true;
    }
  }

  save() {
    this.schemaFieldsForm.markAllAsTouched();
    if (this.schemaFieldsForm.invalid) {
      return;
    }
    // console.log("this.schemaFieldsForm",this.schemaFieldsForm)
    // console.log("this.form",this.form.formGroup.controls[this.schemaFieldsForm.get("selectedField").value].value)

    const newSchemaField = {
      selectedField: this.schemaFieldsForm.get("selectedField").value,
      label: this.form.formGroup.controls[this.schemaFieldsForm.get("selectedField").value].value,
    };

    this.dialogRef.close(newSchemaField);
  }
}
