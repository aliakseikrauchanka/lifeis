/**
 * Web Speech API typings — explicit module (no reliance on global Window merge for CI).
 */

export interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((this: BrowserSpeechRecognition, ev: BrowserSpeechRecognitionEvent) => void) | null;
  onend: ((this: BrowserSpeechRecognition, ev: Event) => void) | null;
  onerror: ((this: BrowserSpeechRecognition, ev: Event) => void) | null;
}

export interface BrowserSpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

export type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

export type SpeechRecognitionWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

/** Standard + webkit-prefixed constructor (browsers differ). */
export function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const w = window as SpeechRecognitionWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
