const Authkey = "";

function teamNumber(keys) {
  const numbers = []
  for (var key of keys) {
    numbers.push(parseInt(key.slice(3)))
  }
  return numbers
}

function eventDataUpdate() {
  const eventCode = "2025txdri"; // replace with relevant event code

  const response = UrlFetchApp.fetch(
    `https://www.thebluealliance.com/api/v3/event/${eventCode}/matches`,
    {
      method: "get",
      headers: { "X-TBA-Auth-Key": Authkey }
    }
  );

  const matches = JSON.parse(response.getContentText());

  const qualMatches = [];
  const semiMatches = [];
  const finalMatches = [];

  for (const match of matches) {
    if (match.comp_level === "qm") qualMatches.push(match);
    else if (match.comp_level === "sf") semiMatches.push(match);
    else if (match.comp_level === "f") finalMatches.push(match);
  }

  qualMatches.sort((a, b) => a.match_number - b.match_number);
  semiMatches.sort((a, b) => a.set_number - b.set_number);
  finalMatches.sort((a, b) => a.match_number - b.match_number);

  const sortedMatches = [
    ...qualMatches,
    ...semiMatches,
    ...finalMatches
  ];

  const matchList = [];
  const blueTeamList = [];
  const redTeamList = [];
  const blueScoreList = [];
  const redScoreList = [];

  for (const match of sortedMatches) {
    const blueTeams = teamNumber(match.alliances.blue.team_keys);
    const redTeams = teamNumber(match.alliances.red.team_keys);

    let label;
    if (match.comp_level === "qm") label = `Quals ${match.match_number}`;
    else if (match.comp_level === "sf") label = `Semis ${match.set_number}`;
    else label = `Finals ${match.match_number}`;

    matchList.push([label]);
    blueTeamList.push(blueTeams);
    redTeamList.push(redTeams);
    blueScoreList.push([match.alliances.blue.score]);
    redScoreList.push([match.alliances.red.score]);
  }

  const sheet = SpreadsheetApp.getActive();

  sheet.getRangeByName("TBA!EventMatchList")
    .offset(0, 0, matchList.length, 1)
    .setValues(matchList);

  sheet.getRangeByName("TBA!EventBlueTeams")
    .offset(0, 0, blueTeamList.length, 3)
    .setValues(blueTeamList);

  sheet.getRangeByName("TBA!EventRedTeams")
    .offset(0, 0, redTeamList.length, 3)
    .setValues(redTeamList);

  sheet.getRangeByName("TBA!EventBlueScore")
    .offset(0, 0, blueScoreList.length, 1)
    .setValues(blueScoreList);

  sheet.getRangeByName("TBA!EventRedScore")
    .offset(0, 0, redScoreList.length, 1)
    .setValues(redScoreList);
}
