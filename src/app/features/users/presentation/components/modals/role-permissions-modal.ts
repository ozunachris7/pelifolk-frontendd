import { Component, input, output } from '@angular/core';
import { Modal } from '../../../../../shared/ui/modal/modal';
import { Role } from '../../../domain/access';
import { permissionLabel, roleLabel } from '../../access-labels';

@Component({
  selector: 'app-role-permissions-modal',
  imports: [Modal],
  templateUrl: './role-permissions-modal.html',
})
export class RolePermissionsModal {
  readonly role = input.required<Role>();
  readonly dismiss = output<void>();
  protected readonly roleLabel = roleLabel;
  protected readonly permissionLabel = permissionLabel;
}
