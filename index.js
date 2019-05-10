const axios = require("axios");
exports.handler = async (event, context, callback) => {
  let playlists = process.env.PLAYLISTS.split(",");
  console.log(playlists);
  let client_id = process.env.CLIENT_ID;
  let client_secret = process.env.CLIENT_SECRET;
  let refresh_token = process.env.REFRESH_TOKEN;
  let daysToKeep = parseInt(process.env.DAYS_TO_KEEP);
  let destinationPlaylistId = process.env.DESTINATION_PLAYLIST;
  let baseUrl = "https://www.googleapis.com";

  //authenticating with google to get access token
  await axios
    .post(
      `${baseUrl}/oauth2/v4/token?client_id=${client_id}&refresh_token=${refresh_token}&client_secret=${client_secret}&grant_type=refresh_token`
    )
    .then(async response => {
      let headers = {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${response.data.access_token}`
        }
      };
      let currentDesinationVideos = [];
      let videosToBeRemoved = [];
      let currDate = new Date();
      currDate.setDate(currDate.getDate() - daysToKeep);
      await axios
        .get(
          `${baseUrl}/youtube/v3/playlistItems?part=contentDetails,status&playlistId=${destinationPlaylistId}&maxResults=50`,
          headers
        )
        .then(async response => {
          for (const vid of response.data.items) {
            let videoDate = new Date(vid.contentDetails.videoPublishedAt);
            let vidId = vid.contentDetails.videoId;
            if (videoDate > currDate) {
              currentDesinationVideos.push(vidId);
            } else {
              videosToBeRemoved.push(vid.id);
            }
          }
        });
      console.log(`removing videos: ${videosToBeRemoved.length}`);
      for (const item of videosToBeRemoved) {
        await axios
          .delete(`${baseUrl}/youtube/v3/playlistItems?id=${item}`, headers)
          .then(async response => {
            console.log(`item: ${item} removed`);
          });
      }
      console.log("starting video process");
      //looping through all my desired playlists
      for (const playlist_id of playlists) {
        console.log(`playlist: ${playlist_id}`);
        //retreiving top 50 videos in the playlist
        await axios
          .get(
            `${baseUrl}/youtube/v3/playlistItems?part=contentDetails,status&playlistId=${playlist_id}&maxResults=50`,
            headers
          )
          .then(async response => {
            console.log("looping through videos");
            //looping through all of the videos
            for (const vid of response.data.items) {
              console.log(`processing video:`);
              console.log(`${vid.contentDetails.videoId}`);
              let videoDate = new Date(vid.contentDetails.videoPublishedAt);

              console.log(currDate);
              console.log(videoDate);
              console.log(`Should add video: ${videoDate > currDate}`);
              //check if the date is older than desired day
              if (videoDate > currDate) {
                let vidId = vid.contentDetails.videoId;
                let found = currentDesinationVideos.find(element => {
                  return element === vidId;
                });
                if (!found) {
                  console.log(`could not find vid: ${vidId}`);
                  //add the video to my playlist
                  await axios
                    .post(
                      `${baseUrl}/youtube/v3/playlistItems?part=snippet`,
                      {
                        snippet: {
                          playlistId: destinationPlaylistId,
                          resourceId: {
                            videoId: vidId,
                            kind: "youtube#video"
                          }
                        }
                      },
                      headers
                    )
                    .then(response => {
                      console.log(`Video: ${vid.contentDetails.videoId} added`);
                    })
                    .catch(error => {
                      console.log(
                        `Video: ${vid.contentDetails.videoId} failed`
                      );
                    });
                } else {
                  console.log(`video: ${vidId} is already in playlist`);
                }
              }
            }
          })
          .catch(error => {
            console.log(error.message);
          });
      }
      callback(null, {
        status: 200,
        body: response.data
      });
    })
    .catch(error => {
      console.log(error.message);
      callback(null, error);
    });
};

async function getPlaylistVideos(playlistVideos, playlistId, token) {
  if (!token === "DONE") return playlistVideos;

  await axios
    .get(
      `${baseUrl}/youtube/v3/playlistItems?part=contentDetails,status&playlistId=${playlistId}&maxResults=50&pageToken=${token}`,
      headers
    )
    .then(async response => {
      for (const vid of response.data.items) {
        playlistVideos.push(vid.contentDetails);
      }
    });
  return getPlaylistVideos(playlistVideos, token);
}
