import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Language } from '../../core/types/language.type';
import { LanguageService } from '../../core/services/language.service';

interface PrivacySection {
  heading: string;
  body: string;
  email?: boolean;
}

interface PrivacyCopy {
  langToggleAria: string;
  title: string;
  intro: string;
  sections: PrivacySection[];
}

/* Locked copy (#132). Standing rules: no em dashes anywhere; Spanish says
   "registro" for the ledger; the App Name is never translated. */
const COPY: Record<Language, PrivacyCopy> = {
  en: {
    langToggleAria: 'Language',
    title: 'Privacy',
    intro:
      'Open Expenses is built so your financial data stays yours. This page says exactly what the app touches, and what it never does.',
    sections: [
      {
        heading: 'What the app accesses',
        body:
          'When you Back up to Google Drive, Open Expenses touches exactly one file, open-expenses-backup.json, in your own Drive, through the drive.file scope. It cannot read, list, or modify any other file in your Drive.',
      },
      {
        heading: 'Where your data lives',
        body:
          'Your data lives in two places, and both are yours: your browser and your own Google Drive. There is no backend, no accounts on our side, and no analytics.',
      },
      {
        heading: 'What happens to your data',
        body:
          'Nothing beyond the Backup you start. Your data is never shared, never sold, and never analyzed. The app has no server, so there is nowhere to send it.',
      },
      {
        heading: 'Revoking access',
        body:
          'The Drive token is revocable at any time from your Google Account, under Security, in third-party apps with account access. Once revoked, Backup and Restore stop until you grant access again.',
      },
      {
        heading: 'Contact',
        body: 'Questions about this policy? Write to us:',
        email: true,
      },
      {
        heading: 'Limited Use',
        body:
          'The use Open Expenses makes of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.',
      },
    ],
  },
  es: {
    langToggleAria: 'Idioma',
    title: 'Privacidad',
    intro:
      'Open Expenses está pensado para que tus datos financieros sean tuyos. Esta página dice exactamente qué toca la app y qué nunca hace.',
    sections: [
      {
        heading: 'Qué accede la app',
        body:
          'Cuando haces una copia a Google Drive, Open Expenses toca exactamente un archivo, open-expenses-backup.json, en tu propio Drive, con el permiso drive.file. No puede leer, listar ni modificar ningún otro archivo de tu Drive.',
      },
      {
        heading: 'Dónde viven tus datos',
        body:
          'Tus datos viven en dos lugares, y los dos son tuyos: tu navegador y tu propio Google Drive. No hay backend, no hay cuentas de nuestro lado y no hay analítica.',
      },
      {
        heading: 'Qué pasa con tus datos',
        body:
          'Nada más allá de la copia que tú inicias. Tus datos nunca se comparten, nunca se venden y nunca se analizan. La app no tiene servidor, así que no hay adónde enviarlos.',
      },
      {
        heading: 'Revocar el acceso',
        body:
          'El token de Drive se puede revocar en cualquier momento desde tu cuenta de Google, en Seguridad, dentro de las apps de terceros con acceso a la cuenta. Tras revocar, la copia y la restauración se detienen hasta que vuelvas a conceder el acceso.',
      },
      {
        heading: 'Contacto',
        body: '¿Preguntas sobre esta política? Escríbenos:',
        email: true,
      },
      {
        heading: 'Uso limitado',
        body:
          'El uso que hace Open Expenses de la información recibida de las APIs de Google sigue la Google API Services User Data Policy, incluidos los requisitos de Limited Use.',
      },
    ],
  },
};

const CONTACT_EMAIL = 'contact@openexpenses.app';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {
  private languageService = inject(LanguageService);

  /* The page follows the app Language; the toggle only overrides the view. */
  private langOverride = signal<Language | null>(null);
  readonly lang = computed(() => this.langOverride() ?? this.languageService.activeLanguage());
  readonly copy = computed(() => COPY[this.lang()]);
  readonly contactEmail = CONTACT_EMAIL;

  constructor() {
    effect(() => {
      document.documentElement.lang = this.lang();
    });
  }

  setLang(lang: Language): void {
    this.langOverride.set(lang);
  }
}
