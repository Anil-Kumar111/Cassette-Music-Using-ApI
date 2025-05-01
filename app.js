let currentAudio = null;
let currentSongId = null;
let isPlaying = false;
let currentSongData = null;
let songQueue = [];
let currentSongIndex = 0;
let repeatMode = "off";
let isShuffle = false;
let featuredSongs = [];
const RECENTLY_PLAYED_STORAGE_KEY = "recentlyPlayed";
const MAX_RECENTLY_PLAYED = 10;
let recentlyPlayed = loadRecentlyPlayed();

let playButton = document.querySelector("#playbtn");
const nextButton = document.querySelector("#nextbtn");
const prevButton = document.querySelector("#prevbtn");
const shuffleButton = document.querySelector("#shufflebtn");
const repeatButton = document.querySelector("#repeatbtn");

const currentTimeDisplay = document.getElementById("current-time");
const totalDurationDisplay = document.getElementById("total-duration");
const timelineSlider = document.querySelector(".timeline-slider");

function updateShuffleButton() {
  if (isShuffle) {
    shuffleButton.classList.add("active");
  } else {
    shuffleButton.classList.remove("active");
  }
}

function updateRepeatButton() {
  repeatButton.classList.remove("repeat-off", "repeat-song", "repeat-playlist");
  if (repeatMode === "off") {
    repeatButton.classList.add("repeat-off");
  } else if (repeatMode === "song") {
    repeatButton.classList.add("repeat-song");
  } else if (repeatMode === "playlist") {
    repeatButton.classList.add("repeat-playlist");
  }
}

function createSongCard(song) {
  const card = document.createElement("div");
  card.classList.add("card");
  card.setAttribute("data-song-id", song.id);

  const songImage = song.image[2]?.url || "./assets/default.jpg";
  const songName = song.name || "Untitled";
  const artistNames = song.artists.primary
    .map((artist) => artist.name)
    .join(", ");

  card.innerHTML = `
        <div class="card-image-container">
            <img src="${songImage}" alt="${songName}" />
            <div class="card-play-overlay">
                <i class="fas fa-play card-play-icon"></i>
            </div>
        </div>
        <div class="card-content">
            <h3>${songName}</h3>
            <p>${artistNames}</p>
        </div>
    `;

  return card;
}

async function playSong(songId) {
  if (!songId) {
    console.warn("No song ID provided.");
    return;
  }

  if (currentSongId === songId && currentAudio) {
    if (isPlaying) {
      pauseSong();
    } else {
      currentAudio.play();
      isPlaying = true;
      playButton.src = "./assets/pause_musicbar.png";
    }
    return;
  }

  const url = `https://saavn.dev/api/songs/${songId}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data.data || data.data.length === 0) {
      console.error("Invalid song data received:", data);
      return;
    }

    const songDetails = data.data[0];

    if (currentAudio) {
      currentAudio.pause();
      currentAudio.removeEventListener("ended", songEnded);
      currentAudio.removeEventListener("timeupdate", updateTimeDisplay);
      currentAudio = null; // Release memory
    }

    currentSongData = {
      id: songDetails.id,
      url: songDetails.downloadUrl[songDetails.downloadUrl.length - 1].url,
      duration: songDetails.duration,
      name: songDetails.name,
      artist: songDetails.primary_artists,
      image: songDetails.image[2]?.url || "./assets/default.jpg",
    };

    const audio = new Audio(currentSongData.url);
    currentAudio = audio;
    currentSongId = songId;

    audio.currentTime = 0;
    audio.play();
    isPlaying = true;

    playButton.src = "./assets/pause_musicbar.png";

    // Update song info in music player
    updateSongInfo(
      currentSongData.image,
      currentSongData.name,
      currentSongData.artist,
    );

    const volumeSlider = document.querySelector(".volume-slider");
    volumeSlider.value = audio.volume * 100;
    volumeSlider.addEventListener("input", (e) => {
      audio.volume = e.target.value / 100;
    });

    timelineSlider.max = currentSongData.duration;

    audio.addEventListener("timeupdate", updateTimeDisplay);

    timelineSlider.addEventListener("input", (e) => {
      audio.currentTime = e.target.value;
    });

    playButton.removeEventListener("click", togglePlayPause);
    playButton.addEventListener("click", togglePlayPause);

    currentAudio.addEventListener("ended", songEnded);

    addToRecentlyPlayed(currentSongData);

    totalDurationDisplay.textContent = formatTime(currentSongData.duration);
  } catch (error) {
    console.error("Error playing song:", error);
  }
}

function pauseSong() {
  if (currentAudio) {
    currentAudio.pause();
    isPlaying = false;
    playButton.src = "./assets/play_musicbar.png";
  }
}

function togglePlayPause() {
  if (isPlaying) {
    pauseSong();
  } else {
    if (currentAudio) {
      currentAudio.play();
      isPlaying = true;
      playButton.src = "./assets/pause_musicbar.png";
    } else if (currentSongId) {
      playSong(currentSongId);
    } else {
      if (featuredSongs.length > 0) {
        playSong(featuredSongs[0].id);
      }
    }
  }
}

playButton.addEventListener("click", togglePlayPause);

// Next Song Functionality
async function playNextSong() {
  if (songQueue.length === 0) {
    console.warn("Song queue is empty.");
    return;
  }

  if (repeatMode === "song") {
    currentAudio.currentTime = 0;
    currentAudio.play();
    return;
  }

  currentSongIndex = (currentSongIndex + 1) % songQueue.length;
  const nextSongId = songQueue[currentSongIndex].id;
  await playSong(nextSongId);
}

// Previous Song Functionality
async function playPreviousSong() {
  if (songQueue.length === 0) {
    console.warn("Song queue is empty.");
    return;
  }

  currentSongIndex =
    (currentSongIndex - 1 + songQueue.length) % songQueue.length;
  const prevSongId = songQueue[currentSongIndex].id;
  await playSong(prevSongId);
}

nextButton.addEventListener("click", playNextSong);
prevButton.addEventListener("click", playPreviousSong);

function songEnded() {
  if (repeatMode === "song") {
    currentAudio.currentTime = 0;
    currentAudio.play();
  } else if (repeatMode === "playlist" || (isShuffle && songQueue.length > 0)) {
    playNextSong();
  } else {
    pauseSong();
  }
}

shuffleButton.addEventListener("click", () => {
  isShuffle = !isShuffle;
  updateShuffleButton();
  if (isShuffle) {
    shuffleQueue();
  } else {
    restoreQueue();
  }
});

repeatButton.addEventListener("click", () => {
  if (repeatMode === "off") {
    repeatMode = "song";
  } else if (repeatMode === "song") {
    repeatMode = "playlist";
  } else {
    repeatMode = "off";
  }
  updateRepeatButton();
});

let originalQueue = [];

function shuffleQueue() {
  originalQueue = [...songQueue];
  for (let i = songQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [songQueue[i], songQueue[j]] = [songQueue[j], songQueue[i]];
  }
}

function restoreQueue() {
  songQueue = [...originalQueue];
  originalQueue = [];
}

document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.querySelector('input[type="search"]');

  searchInput.addEventListener("input", async (e) => {
    const query = e.target.value;
    if (query.length > 2) {
      const data = await searchSongs(query);
      if (data && data.results) {
        renderSearchResults(data.results);
      } else {
        console.warn("No search results found or invalid data.");
      }
    } else {
      const cardsContainer = document.querySelector(".cards-container");
      cardsContainer.innerHTML = "";
    }
  });
});

async function searchSongs(query) {
  const url = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error("Error searching songs:", error);
    return null;
  }
}

function renderSearchResults(songs) {
  const cardsContainer = document.querySelector(".cards-container");
  cardsContainer.innerHTML = "";

  if (!songs || songs.length === 0) {
    cardsContainer.innerHTML = "<p>No results found.</p>";
    return;
  }

  songs.forEach((song) => {
    const card = createSongCard(song);
    cardsContainer.appendChild(card);
  });

  cardsContainer.addEventListener("click", async (event) => {
    const card = event.target.closest(".card");
    if (card) {
      const songId = card.getAttribute("data-song-id");
      songQueue = songs; // Update the song queue
      currentSongIndex = songQueue.findIndex((song) => song.id === songId);
      await playSong(songId);
    }
  });
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}

function updateSongInfo(imageUrl, songTitle, artistName) {
  document.querySelector(".song-info img").src = imageUrl;
  document.querySelector(".song-title").textContent = songTitle;
  document.querySelector(".artist-name").textContent = artistName;
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const trendingSongs = await searchSongs("trending");
    if (trendingSongs && trendingSongs.results) {
      featuredSongs = trendingSongs.results;
      renderSearchResults(featuredSongs);
      songQueue = featuredSongs; // Initial song queue
    } else {
      console.warn("Could not load featured songs.");
    }
  } catch (error) {
    console.error("Error fetching featured songs:", error);
  }

  // Load and display recently played songs
  loadAndDisplayRecentlyPlayed();
});

function updateTimeDisplay() {
  if (currentAudio) {
    currentTimeDisplay.textContent = formatTime(currentAudio.currentTime);
    timelineSlider.value = currentAudio.currentTime;
  }
}

function loadRecentlyPlayed() {
  try {
    const storedSongs = localStorage.getItem(RECENTLY_PLAYED_STORAGE_KEY);
    return storedSongs ? JSON.parse(storedSongs) : [];
  } catch (error) {
    console.error("Error loading recently played songs:", error);
    return [];
  }
}

function saveRecentlyPlayed() {
  try {
    localStorage.setItem(
      RECENTLY_PLAYED_STORAGE_KEY,
      JSON.stringify(recentlyPlayed),
    );
  } catch (error) {
    console.error("Error saving recently played songs:", error);
  }
}

function addToRecentlyPlayed(song) {
  const index = recentlyPlayed.findIndex((s) => s.id === song.id);

  if (index !== -1) {
    recentlyPlayed.splice(index, 1);
  }

  recentlyPlayed.unshift(song);

  if (recentlyPlayed.length > MAX_RECENTLY_PLAYED) {
    recentlyPlayed.pop();
  }

  saveRecentlyPlayed();

  displayRecentlyPlayed();
}

function displayRecentlyPlayed() {
  const recentlyPlayedList = document.getElementById("recently-played-list");
  recentlyPlayedList.innerHTML = "";

  recentlyPlayed.forEach((song) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `<a href="#" data-song-id="${song.id}">${song.name} - ${song.artist}</a>`;
    recentlyPlayedList.appendChild(listItem);
  });
}

function loadAndDisplayRecentlyPlayed() {
  recentlyPlayed = loadRecentlyPlayed();
  displayRecentlyPlayed();

  const recentlyPlayedList = document.getElementById("recently-played-list");
  recentlyPlayedList.addEventListener("click", async (event) => {
    if (event.target.tagName === "A") {
      event.preventDefault();
      const songId = event.target.getAttribute("data-song-id");
      if (songId) {
        await playSong(songId);
      }
    }
  });
}
