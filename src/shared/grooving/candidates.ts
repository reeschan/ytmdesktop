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

export function buildGroovingCandidates(input: { direction: GroovingDirection; historyShared: boolean; sources: GroovingSources }): {
  candidates: GroovingCandidate[];
  filledFromMood: boolean;
} {
  const { direction, sources } = input;
  // The history and the liked tracks decide the known artists even when the history is not shared (they are only used inside the app)
  const known = knownArtists(sources.history, sources.liked);
  const familiar = uniqueByVideoId(
    [...sources.history, ...sources.liked, ...sources.related]
      .map(track => mark(track, known))
      .filter(track => track.kind === GroovingTrackKind.Familiar)
  );
  const moodTracks = sources.mood.map(track => mark(track, known));
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
