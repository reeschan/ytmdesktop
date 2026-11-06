import {
  GROOVING_CANDIDATE_LIMIT,
  GROOVING_FAMILIAR_MINIMUM,
  GroovingCandidate,
  GroovingDirection,
  GroovingSources,
  GroovingTrack,
  GroovingTrackKind
} from "./index";

const normalizeArtist = (name: string): string => name.trim().toLowerCase();

// The artists that appear in the history and the liked tracks, compared without case and surrounding spaces
export function knownArtists(history: GroovingTrack[], liked: GroovingTrack[]): Set<string> {
  const known = new Set<string>();
  for (const track of [...history, ...liked]) {
    for (const artist of track.artists) {
      const name = normalizeArtist(artist);
      if (name) known.add(name);
    }
  }
  return known;
}

export const mark = (track: GroovingTrack, known: Set<string>): GroovingCandidate => ({
  ...track,
  kind: track.artists.some(artist => known.has(normalizeArtist(artist))) ? GroovingTrackKind.Familiar : GroovingTrackKind.New
});

// Keeps the first track of each videoId
export const uniqueByVideoId = <T extends { videoId: string }>(list: T[]): T[] => {
  const seen = new Set<string>();
  return list.filter(track => {
    if (seen.has(track.videoId)) return false;
    seen.add(track.videoId);
    return true;
  });
};

// One from first, one from second, and so on; the rest of the longer list goes at the end (for example familiar and new
// candidates, or playlist and search tracks)
export const alternate = <T>(first: T[], second: T[]): T[] => {
  const result: T[] = [];
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    if (i < first.length) result.push(first[i]);
    if (i < second.length) result.push(second[i]);
  }
  return result;
};

// The seed song of a "From a song" run. videoId is null when it is not known
export type GroovingSeedMatch = { videoId: string | null; title: string; artist: string };

const normalizeText = (text: string): string => text.trim().toLowerCase();

// Whether the track is the seed song: the same videoId, or the same title and the same first artist (without case and surrounding spaces)
export function isSeedTrack(track: GroovingTrack, seed: GroovingSeedMatch): boolean {
  if (seed.videoId !== null && track.videoId === seed.videoId) return true;
  const title = normalizeText(seed.title);
  if (title === "") return false;
  return normalizeText(track.title) === title && normalizeArtist(track.artists[0] ?? "") === normalizeArtist(seed.artist);
}

export function buildGroovingCandidates(input: {
  direction: GroovingDirection;
  historyShared: boolean;
  sources: GroovingSources;
  // The seed song, left out of the candidates; null or missing when the mood is not a song
  seed?: GroovingSeedMatch | null;
}): {
  candidates: GroovingCandidate[];
  filledFromMood: boolean;
} {
  const { direction, sources, seed = null } = input;
  const notSeed = (track: GroovingCandidate): boolean => seed === null || !isSeedTrack(track, seed);
  // The history and the liked tracks decide the known artists even when the history is not shared (they are only used inside the app)
  // The seed song is left out after the kinds are decided, so its removal never changes which artists are known
  const known = knownArtists(sources.history, sources.liked);
  const moodTracks = sources.mood.map(track => mark(track, known)).filter(notSeed);
  // In a song run the page sends the seed's related tracks as mood (related is empty), so their familiar tracks join the
  // familiar pool before the history: the limit then cuts the history and not the seed's related tracks
  const familiarMood = seed === null ? [] : moodTracks.filter(track => track.kind === GroovingTrackKind.Familiar);
  const familiar = uniqueByVideoId(
    [...familiarMood, ...sources.history, ...sources.liked, ...sources.related]
      .map(track => mark(track, known))
      .filter(track => track.kind === GroovingTrackKind.Familiar)
      .filter(notSeed)
  );
  const discover = uniqueByVideoId(moodTracks.filter(track => track.kind === GroovingTrackKind.New));

  if (direction === GroovingDirection.Familiar) {
    if (familiar.length >= GROOVING_FAMILIAR_MINIMUM) return { candidates: familiar.slice(0, GROOVING_CANDIDATE_LIMIT), filledFromMood: false };
    // Fill with the mood tracks that are not candidates yet, keeping their kind
    const filled = uniqueByVideoId([...familiar, ...moodTracks]);
    return { candidates: filled.slice(0, GROOVING_CANDIDATE_LIMIT), filledFromMood: filled.length > familiar.length };
  }

  if (direction === GroovingDirection.Discover) return { candidates: discover.slice(0, GROOVING_CANDIDATE_LIMIT), filledFromMood: false };

  return { candidates: uniqueByVideoId(alternate(familiar, discover)).slice(0, GROOVING_CANDIDATE_LIMIT), filledFromMood: false };
}
