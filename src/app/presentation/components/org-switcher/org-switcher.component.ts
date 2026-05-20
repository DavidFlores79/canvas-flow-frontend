import { Component, inject } from '@angular/core';
import { AuthStore } from '../../../application/stores/auth.store';

@Component({
  selector: 'app-org-switcher',
  standalone: true,
  templateUrl: './org-switcher.component.html',
})
export class OrgSwitcherComponent {
  protected readonly authStore = inject(AuthStore);

  onOrgChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value) {
      void this.authStore.switchOrganization(value);
    }
  }
}
