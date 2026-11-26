import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-500.css'
import '@fontsource/montserrat/latin-ext-400.css'
import '@fontsource/montserrat/latin-ext-500.css'
import { mountCommandBar } from './mount'

// Fallback okno pro stránky, kam se overlay nedá vložit (chrome://, Web Store, New Tab).
void mountCommandBar(document.body, 'popup', () => window.close())
