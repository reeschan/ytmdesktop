import { describe, expect, it } from "vitest";
import { GroovingAnswer, GroovingCandidate, GroovingDirection, GroovingTrackKind } from "~shared/grooving";
import { LikeStatus, PlayerQueue, PlayerState, VideoState, VideoType } from "~shared/playerstatestore/types";
import { continuationRequest, observeTrack } from "./effects";

const queueItem = (videoId: string, selected: boolean) => ({
  thumbnails: [],
  title: videoId,
  author: "a",
  duration: "3:00",
  selected,
  videoId,
  counterparts: null
});

// The store can already have moved to the next track in the queue while the details still name the previous one
function playerState(videoId: string, likeStatus: LikeStatus, progress: number, selectedVideoId: string): PlayerState {
  const ids = ["t1", "t2", "t3"];
  const queue: PlayerQueue = {
    automixItems: [],
    autoplay: false,
    isGenerating: false,
    isInfinite: false,
    items: ids.map(id => queueItem(id, id === selectedVideoId)),
    repeatMode: 0,
    selectedItemIndex: ids.indexOf(selectedVideoId),
    shuffleEnabled: false
  };
  return {
    videoDetails: {
      album: null,
      albumId: null,
      author: "a",
      channelId: "c",
      durationSeconds: 180,
      thumbnails: [],
      title: videoId,
      id: videoId,
      likeStatus,
      videoType: VideoType.MusicAudio,
      isLive: false
    },
    playlistId: null,
    trackState: VideoState.Playing,
    queue,
    videoProgress: progress,
    volume: 50,
    muted: false,
    adPlaying: false,
    hasFullMetadata: true
  };
}

const candidate = (videoId: string, kind: GroovingTrackKind): GroovingCandidate => ({
  videoId,
  title: videoId,
  artists: [videoId],
  thumbnailUrl: null,
  kind
});

describe("observeTrack", () => {
  it("keeps the like of the watched track when the queue already selects the next one", () => {
    // t1 plays and is liked
    let watch = observeTrack(null, playerState("t1", LikeStatus.Like, 0, "t1"), null).next;
    watch = observeTrack(watch, playerState("t1", LikeStatus.Like, 120, "t1"), null).next;
    // updateFromStore: the queue selects t2 and likeStatus is t2's, while videoDetails is still t1
    watch = observeTrack(watch, playerState("t1", LikeStatus.Indifferent, 0, "t2"), null).next;
    // updateVideoDetails: t2 starts
    const observation = observeTrack(watch, playerState("t2", LikeStatus.Indifferent, 0, "t2"), null);

    expect(observation.reaction?.videoId).toBe("t1");
    expect(observation.reaction?.last.likeStatus).toBe(LikeStatus.Like);
  });
});

describe("continuationRequest", () => {
  it("counts Familiar from the continuation candidates, not the run's", () => {
    // 40 familiar tracks in the run; 25 of them are already listed, so the continuation holds at most 15
    const familiar = Array.from({ length: 40 }, (_, index) => candidate(`f${index}`, GroovingTrackKind.Familiar));
    const fresh = Array.from({ length: 40 }, (_, index) => candidate(`n${index}`, GroovingTrackKind.New));
    const request = continuationRequest({
      candidates: [...familiar, ...fresh],
      direction: GroovingDirection.Familiar,
      history: [],
      listed: familiar.slice(0, 25),
      reactions: {},
      knownArtists: new Set(familiar.map(track => track.artists[0])),
      related: []
    });

    const familiarInCandidates = request.candidates.filter(track => track.kind === GroovingTrackKind.Familiar).length;
    expect(familiarInCandidates).toBe(15);
    expect(request.familiarCount).toBe(familiarInCandidates);
  });

  it("leaves out the tracks of a pair answered neither in a Mix", () => {
    const familiar = Array.from({ length: 30 }, (_, index) => candidate(`f${index}`, GroovingTrackKind.Familiar));
    const fresh = Array.from({ length: 30 }, (_, index) => candidate(`n${index}`, GroovingTrackKind.New));
    const request = continuationRequest({
      candidates: [...familiar, ...fresh],
      direction: GroovingDirection.Mix,
      history: [{ pair: { left: "f29", right: "n29", reason: "" }, answer: GroovingAnswer.Neither }],
      listed: [...familiar.slice(0, 12), ...fresh.slice(0, 13)],
      reactions: {},
      knownArtists: new Set(familiar.map(track => track.artists[0])),
      related: []
    });

    const ids = request.candidates.map(track => track.videoId);
    expect(ids).not.toContain("f29");
    expect(ids).not.toContain("n29");
  });

  it("leaves the seed song out of the continuation candidates", () => {
    // The seed can come back through the related tracks, or with the same title and artist under another videoId
    const familiar = Array.from({ length: 20 }, (_, index) => candidate(`f${index}`, GroovingTrackKind.Familiar));
    const fresh = Array.from({ length: 5 }, (_, index) => candidate(`n${index}`, GroovingTrackKind.New));
    const byTitle = { ...candidate("s2", GroovingTrackKind.New), title: "Seed Song", artists: ["Seed Artist"] };
    const request = continuationRequest({
      candidates: [...familiar, ...fresh, candidate("seed", GroovingTrackKind.Familiar), byTitle],
      direction: GroovingDirection.Familiar,
      history: [],
      listed: [],
      reactions: {},
      knownArtists: new Set(familiar.map(track => track.artists[0])),
      related: [candidate("seed", GroovingTrackKind.New), candidate("neighbour", GroovingTrackKind.Familiar)],
      seed: { videoId: "seed", title: "Seed Song", artist: "Seed Artist" }
    });

    const ids = request.candidates.map(track => track.videoId);
    expect(ids).not.toContain("seed");
    expect(ids).not.toContain("s2");
    // The familiar count is decided after the seed is left out
    expect(request.familiarCount).toBe(request.candidates.filter(track => track.kind === GroovingTrackKind.Familiar).length);
  });
});
