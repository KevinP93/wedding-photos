import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private promptEvent: any;

  constructor(private swUpdate: SwUpdate) {
    // Écouter les mises à jour disponibles
    if (swUpdate.isEnabled) {
      swUpdate.versionUpdates
        .pipe(
          filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
          map(evt => evt.latestVersion)
        )
        .subscribe(() => {
          if (confirm('Une nouvelle version est disponible. Voulez-vous la charger ?')) {
            window.location.reload();
          }
        });
    }
  }

  // Vérifier si l'app peut être installée
  canInstall(): boolean {
    return this.promptEvent !== null;
  }

  // Installer l'app
  install(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.promptEvent) {
        this.promptEvent.prompt();
        this.promptEvent.userChoice.then((choiceResult: any) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('App installée avec succès');
            resolve();
          } else {
            console.log('Installation refusée');
            reject();
          }
          this.promptEvent = null;
        });
      } else {
        reject('Installation non disponible');
      }
    });
  }

  // Enregistrer l'événement d'installation
  setPromptEvent(event: any): void {
    this.promptEvent = event;
  }

  // Vérifier les mises à jour
  checkForUpdates(): void {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.checkForUpdate().then(() => {
        console.log('Vérification des mises à jour terminée');
      });
    }
  }
}
