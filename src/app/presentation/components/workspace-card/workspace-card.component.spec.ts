import { TestBed } from '@angular/core/testing';
import { WorkspaceCardComponent } from './workspace-card.component';
import { Workspace } from '../../../domain/models/workspace.model';

const mockWorkspace: Workspace = {
  id: 'ws-1',
  organizationId: 'org-1',
  name: 'Test Workspace',
  ownerId: 'user-1',
};

describe('WorkspaceCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkspaceCardComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(WorkspaceCardComponent);
    fixture.componentInstance.workspace = mockWorkspace;
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display workspace name', () => {
    const fixture = TestBed.createComponent(WorkspaceCardComponent);
    fixture.componentInstance.workspace = mockWorkspace;
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Test Workspace');
  });

  it('should emit selected event on click', () => {
    const fixture = TestBed.createComponent(WorkspaceCardComponent);
    fixture.componentInstance.workspace = mockWorkspace;
    fixture.detectChanges();

    let emitted: Workspace | undefined;
    fixture.componentInstance.selected.subscribe((ws: Workspace) => (emitted = ws));

    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();
    expect(emitted).toEqual(mockWorkspace);
  });
});
