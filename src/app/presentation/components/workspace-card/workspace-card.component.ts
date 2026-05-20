import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Workspace } from '../../../domain/models/workspace.model';

@Component({
  selector: 'app-workspace-card',
  standalone: true,
  templateUrl: './workspace-card.component.html',
})
export class WorkspaceCardComponent {
  @Input({ required: true }) workspace!: Workspace;
  @Output() readonly selected = new EventEmitter<Workspace>();

  onSelect(): void {
    this.selected.emit(this.workspace);
  }
}
