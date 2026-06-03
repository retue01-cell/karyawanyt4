function testUpdateShifts() {
  const result = autoUpdateDailyShifts();
  console.log("TEST RESULT:", result);
  
  if (result.success) {
    console.log(result.message);
  } else {
    console.log("TEST FAILED:", result.error);
  }
}
