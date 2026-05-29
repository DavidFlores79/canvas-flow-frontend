import { Component, OnInit, signal } from '@angular/core';
import { LucideSun, LucideMoon } from '@lucide/angular';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [LucideSun, LucideMoon],
  templateUrl: './theme-toggle.component.html',
})
export class ThemeToggleComponent implements OnInit {
  protected readonly isDark = signal(false);

  ngOnInit(): void {
    this.isDark.set(document.documentElement.classList.contains('dark'));
  }

  toggle(): void {
    const dark = !this.isDark();
    this.isDark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }
}
