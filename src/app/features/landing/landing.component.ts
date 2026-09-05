import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Language, detectBrowserLanguage } from '../../core/types/language.type';

interface LandingCopy {
  langToggleAria: string;
  posterLines: string[];
  posterNoLines: string[];
  manifesto: string;
  ctaApp: string;
  ctaSource: string;
  selfHostLabel: string;
  selfHostBody: string;
  footer: string;
}

/* Locked copy (#122, #131). Standing rules: no em dashes anywhere; Spanish
   says "registro" for the ledger; the App Name is never translated. */
const COPY: Record<Language, LandingCopy> = {
  en: {
    langToggleAria: 'Language',
    posterLines: ['YOUR MONEY.', 'YOUR BROWSER.', 'YOUR LEDGER.'],
    posterNoLines: ['NO ACCOUNT.', 'NO SERVER.', 'NO TRACKING.'],
    manifesto:
      'Open Expenses is a personal expense tracker that replaces the spreadsheet. It runs entirely in your browser, keeps every figure on your device, and offers one optional Backup to your own Google Drive. Free software, AGPL-3.0.',
    ctaApp: 'Open the app',
    ctaSource: 'View source',
    selfHostLabel: 'Self-host',
    selfHostBody:
      'It is a static site: clone the repo and host it anywhere. This hosted copy is just the easy way in.',
    footer: 'Open Expenses is free software under AGPL-3.0.',
  },
  es: {
    langToggleAria: 'Idioma',
    posterLines: ['TU DINERO.', 'TU NAVEGADOR.', 'TU REGISTRO.'],
    posterNoLines: ['SIN CUENTA.', 'SIN SERVIDOR.', 'SIN RASTREO.'],
    manifesto:
      'Open Expenses es un controlador de gastos personales que reemplaza la hoja de cálculo. Funciona por completo en tu navegador, guarda cada cifra en tu dispositivo y ofrece un único Backup opcional a tu propio Google Drive. Software libre, AGPL-3.0.',
    ctaApp: 'Abrir la app',
    ctaSource: 'Ver el código',
    selfHostLabel: 'Autoalojamiento',
    selfHostBody:
      'Es un sitio estático: clona el repo y alójalo donde quieras. Esta copia alojada es solo la forma fácil de entrar.',
    footer: 'Open Expenses es software libre bajo AGPL-3.0.',
  },
};

const REPO_URL = 'https://github.com/lautibonet/open-expenses';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  readonly repoUrl = REPO_URL;
  readonly lang = signal<Language>(detectBrowserLanguage());
  readonly copy = computed(() => COPY[this.lang()]);

  constructor() {
    document.documentElement.lang = this.lang();
  }

  setLang(lang: Language): void {
    this.lang.set(lang);
    document.documentElement.lang = lang;
  }
}
