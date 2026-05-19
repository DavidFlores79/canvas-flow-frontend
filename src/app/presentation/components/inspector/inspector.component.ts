import { Component, inject } from '@angular/core';
import { EditorStore } from '../../../application/stores/editor.store';

@Component({
  selector: 'app-inspector',
  standalone: true,
  templateUrl: './inspector.component.html',
})
export class InspectorComponent {
  protected readonly editorStore = inject(EditorStore);
}
