export class YoutubePlayer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.player = null;
    this.currentTime = 0;
  }
  loadVideo(videoId) {
    const iframe = document.createElement("iframe");
    iframe.width = "100%";
    iframe.height = "400";
    iframe.src = `https://www.youtube.com/embed/${videoId}`;
    iframe.frameborder = "0";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    this.container.innerHTML = "";
    this.container.appendChild(iframe);
  }
  getCurrentTime() {
    return this.currentTime;
  }
  seekTo(seconds) {
    this.currentTime = seconds;
  }
}
