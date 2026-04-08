import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaInstallComponent } from './components/pwa-install/pwa-install.component';
import { I18nService } from './services/i18n.service';
import { PushNotificationsService } from './services/push-notifications.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PwaInstallComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'wedding-photos';

  constructor(
    public i18n: I18nService,
    private pushNotificationsService: PushNotificationsService
  ) {
    void this.pushNotificationsService.refreshState();
  }
}
