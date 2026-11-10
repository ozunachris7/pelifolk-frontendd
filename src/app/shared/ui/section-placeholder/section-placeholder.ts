import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule, Sprout } from 'lucide-angular';

@Component({
  selector: 'app-section-placeholder',
  imports: [RouterLink, LucideAngularModule],
  templateUrl: './section-placeholder.html',
})
export class SectionPlaceholder {
  protected readonly data = inject(ActivatedRoute).snapshot.data;
  protected readonly icon = Sprout;
}
