import { TestBed } from '@angular/core/testing';
import { EditorStore } from './editor.store';
import { Layer } from '../../domain/models/layer.model';

const makeLayer = (id: string): Layer => ({
  id,
  type: 'shape',
  properties: { x: 0, y: 0, width: 100, height: 100, rotation: 0, zIndex: 0 },
});

describe('EditorStore', () => {
  let store: EditorStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(EditorStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should start with no layers', () => {
    expect(store.layers()).toEqual([]);
  });

  it('should start with canEdit false when role is null', () => {
    expect(store.canEdit()).toBeFalse();
  });

  it('should allow editing for owner role', () => {
    store.setWorkspaceRole('owner');
    expect(store.canEdit()).toBeTrue();
  });

  it('should allow editing for editor role', () => {
    store.setWorkspaceRole('editor');
    expect(store.canEdit()).toBeTrue();
  });

  it('should disallow editing for viewer role', () => {
    store.setWorkspaceRole('viewer');
    expect(store.canEdit()).toBeFalse();
  });

  it('should add a layer', () => {
    const layer = makeLayer('l1');
    store.addLayer(layer);
    expect(store.layers().length).toBe(1);
    expect(store.layers()[0].id).toBe('l1');
  });

  it('should remove a layer', () => {
    store.addLayer(makeLayer('l1'));
    store.addLayer(makeLayer('l2'));
    store.removeLayer('l1');
    expect(store.layers().length).toBe(1);
    expect(store.layers()[0].id).toBe('l2');
  });

  it('should update a layer', () => {
    store.addLayer(makeLayer('l1'));
    store.updateLayer('l1', { content: 'hello' });
    expect(store.layers()[0].content).toBe('hello');
  });

  it('should select layers', () => {
    store.addLayer(makeLayer('l1'));
    store.selectLayers(['l1']);
    expect(store.selectedLayerIds()).toContain('l1');
  });

  it('should compute selectedLayers correctly', () => {
    store.setLayers([makeLayer('l1'), makeLayer('l2')]);
    store.selectLayers(['l2']);
    expect(store.selectedLayers().length).toBe(1);
    expect(store.selectedLayers()[0].id).toBe('l2');
  });

  it('should undo last action', () => {
    store.setLayers([]);
    store.addLayer(makeLayer('l1'));
    store.undo();
    expect(store.layers().length).toBe(0);
  });

  it('should redo after undo', () => {
    store.setLayers([]);
    store.addLayer(makeLayer('l1'));
    store.undo();
    store.redo();
    expect(store.layers().length).toBe(1);
  });
});
