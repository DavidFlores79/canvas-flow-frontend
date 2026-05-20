export interface Project {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly version: number;
}
