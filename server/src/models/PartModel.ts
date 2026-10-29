// Avatar head parts (shared/parts.json): the list the avatar editor saves. A part needs its art in
// client/public/assets/head/<id>.png, so the editor can tune parts but not invent ones with no image.
import { readdirSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { partsError, formatParts, type Part } from '../../../shared/avatar.ts';

const FILE = fileURLToPath(new URL('../../../shared/parts.json', import.meta.url));
const ART = fileURLToPath(new URL('../../../client/public/assets/head/', import.meta.url));

const partsWithArt = () => readdirSync(ART).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4));

/** Check and write the part list. Nothing is written if it has a problem. */
export function saveParts(list: Part[]): { saved: boolean; error?: string } {
    const error = partsError(list, partsWithArt());
    if (error) return { saved: false, error };
    const tmp = FILE + '.tmp';     // temp file first so a crash can't leave half a list on disk
    writeFileSync(tmp, formatParts(list));
    renameSync(tmp, FILE);
    return { saved: true };
}
