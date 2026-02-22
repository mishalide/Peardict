function createFiveMinuteTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "eventDataUpdate")
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger("eventDataUpdate")
    .timeBased()
    .everyMinutes(5)
    .create();
}
