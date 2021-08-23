/*********************/
/* Utility Functions */
/*********************/

/**
 * Executes a selector query on a node and returns the first match
 * @param {String} q - The selector query
 * @param {Node} el - The node to execute the query on, defaults to document
 * @returns {Node}
 */
 function $(q, el = document){
	return el.querySelector(q);
}

/**
 * Executes a selector query on a node and returns all matching elements
 * @param {String} q - The selector query
 * @param {Node} el - The node to execute the query on, defaults to document
 * @returns {Array<Node>}
 */
 function $$(q, el = document){
	return Array.from(el.querySelectorAll(q));
}


/******************/
/* DOM References */
/******************/
// Make a reference to each element we'll need to use later
// My preference is to label their type first (e.g. style, input, button, audio, or a generic element)
// and then the name of the dom element
const style_animation = $("#animationStyle");

const inp_cadence = $("#cadence");
const inp_driveTime = $("#driveTime");
const inp_recoverTime = $("#recoverTime");

const btn_startStop = $("#startStop");
const btn_reset = $("#reset");

const elem_rower = $(".rower");

const audio_countdown = $("#soundCountdown");
const audio_catch = $("#soundCatch");
const audio_finish = $("#soundFinish");



/*******************/
/* Event Listeners */
/*******************/
// When someone clicks a button
btn_startStop.addEventListener("click", toggleStartStop);
btn_reset.addEventListener("click", resetInputs);

// When the animation starts over again
elem_rower.addEventListener("animationiteration", triggerAnimationIteration);

// When an input is updated
inp_cadence.addEventListener("input", inputUpdated);
inp_driveTime.addEventListener("input", inputUpdated);
inp_recoverTime.addEventListener("input", inputUpdated);


/*************/
/* Variables */
/*************/
// Keep track of the timeout ids
const timeoutIDs = {};

// Keep track of whether or not the animation is currently playing
let animationPlaying = false;

// Establish certain animation durations in milliseconds
const colorChangeDuration = 250; // ms
const countdownDuration = 3300; // ms

// Keep track of the current pace inputs/settings
let paceSettings = {};
// Keep track of which pace settings were most recently updated
let previousSettings = ["", ""];



/*********************/
/* Handle Animations */
/*********************/
/**
 * Update the animation style's code so that it accurately reflects the current pace settings
 */
function updateAnimationCode(){
	seconds = 60 / paceSettings.cadence;
	elem_rower.style.setProperty("--iterationDuration", `${seconds}s`);
	const ratio = (100 * paceSettings.driveTime) / (paceSettings.driveTime + paceSettings.recoverTime);
	style_animation.innerHTML =
`		@keyframes myAnim {
			0%, 100% {
				transform: translateX(43.66%);
			}
			${ratio}% {
				transform: translateX(0px);
			}
		}`;
}

/**
 * Toggle whether or not the animation is running
 */
function toggleStartStop(){
	// if animation is currently playing
	if (animationPlaying){
		stopAnimation();
		// bail
		return;
	}

	// If there aren't enough inputs
	if (paceSettings.cadence == 0 || paceSettings.driveTime == 0 || paceSettings.recoverTime == 0){
		// bail
		return;
	}

	// Otherwise
	startAnimation();
}

/**
 * Start up the animation
 */
async function startAnimation(){
	// Establish that the animation is running
	animationPlaying = true;
	// Update the button text
	btn_startStop.textContent = "Stop";

	// Start the countdown sound
	playCountdownSound();
	// Wait for the countdown sound to finish
	await wait(countdownDuration, "countdown");

	// Start the rowing animation
	elem_rower.classList.add("animating");
	// Make sure to trigger the iteration function for the first time
	triggerAnimationIteration();

}

/**
 * When the animation starts, play sounds and change colors accordingly
 */
function triggerAnimationIteration(){
	// Start the function that plays the sounds at the right times
	playSounds();
	// Start the function that changes the colors at the right times
	changeColors();
}

/**
 * Play the catch and recover sounds at the right times
 */
async function playSounds(){
	playCatchSound();
	// Wait for the drive to finish
	await wait(paceSettings.driveTime * 1000, "sounds");
	playRecoverSound();
	// Wait for the recover to finish
	// This isn't strictly necessary, but allows us to chain things together if we want to
	await wait(paceSettings.recoverTime * 1000, "sounds");
}

/**
 * Changes the color of the rower at the right times
 */
async function changeColors(){
	// Start the function that shows catch color for just a moment
	showCatchColor();
	// Wait for the entire drive to finish
	await wait(paceSettings.driveTime*1000, "colorChange");
	// Start the function that shows finish color for just a moment
	showFinishColor();
}

/**
 * Change to and from the catch color for the right amount of time
 */
async function showCatchColor(){
	// Show the rower's catch color
	elem_rower.classList.add("catch");
	// Wait for the duration we need to show the color
	await wait(colorChangeDuration, "catchColor");
	// Switch back to the default rower color
	elem_rower.classList.remove("catch");
}

/**
 * Change to and from the finish color for the right amount of time
 */
async function showFinishColor(){
	// Show the rower's finish color
	elem_rower.classList.add("finish");
	// Wait for the duration we need to show the color
	await wait(colorChangeDuration, "finishColor");
	// Switch back to the default rower color
	elem_rower.classList.remove("finish");
}

/**
 * Restart the countdown audio and play it
 */
function playCountdownSound(){
	audio_countdown.currentTime = 0;
	audio_countdown.play();
}

/**
 * Restart the catch audio and play it
 */
function playCatchSound(){
	// Pause finish sounds if need be
	audio_finish.pause();

	// Make sure this audio is at start
	audio_catch.currentTime = 0;
	// Play it
	audio_catch.play();
}

/**
 * Restart the catch audio and play it
 */
function playRecoverSound(){
	// Pause catch sound if need be
	audio_catch.pause();

	// Make sure this audio is at start
	audio_finish.currentTime = 0;
	// Play it
	audio_finish.play();
}

/**
 * Pause all of the audio players
 */
function pauseAllAudio(){
	audio_countdown.pause();
	audio_catch.pause();
	audio_finish.pause();
}

/**
 * Stop the animation from running and reset everything
 */
function stopAnimation(){
	// Reset the button text
	btn_startStop.textContent = "Start";

	// Establish that the animatino isn't playing
	animationPlaying = false;
	
	// Get each timeout id value
	Object.values(timeoutIDs)
	// For each one, prevent the timeout from triggering again
	.forEach(clearTimeout);
	
	// Clear all of the classes that the rower could have on it
	elem_rower.classList.remove("recover", "drive", "finish", "catch", "animating");

	// Make sure that all of the audio has stopped
	pauseAllAudio();
}


/*****************/
/* Handle Inputs */
/*****************/
/**
 * Put all of the HTML inputs back to their original state and update the pace settings object
 */
function resetInputs(){
	// Make sure the animation isn't running
	stopAnimation();

	// Clear out the HTML inputs
	inp_cadence.value = "";
	inp_driveTime.value = "";
	inp_recoverTime.value = "";

	// Reset the pace settings object
	paceSettings.cadence = 0;
	paceSettings.driveTime = 0;
	paceSettings.recoverTime = 0;

	// Reset the object to keep track of which settings were updated most recently
	previousSettings = ["", ""];
}

/**
 * When an input is updated, update the settings object and try to calculate the remaining inputs
 */
function inputUpdated(){
	// Make sure animation isn't running
	stopAnimation();

	// this = whatever input was updated
	thisSetting = this.id;
	
	// This was the most recent setting
	addToPreviousSettings(thisSetting);

	// Turn the input into a number
	paceSettings[thisSetting] = Number.parseFloat(this.value);

	// if this is the first input
	if (!previousSettings[0]){
		// Bail, we need at least two inputs first
		return;
	}

	// Find which setting to update
	settingToUpdate = findRemainingInput(thisSetting);

	// update that setting
	updatePaceSetting(settingToUpdate);

	// update the animation code
	updateAnimationCode();
}

/**
 * Update the previous settings object with what was just updated
 * @param {String} setting - The setting that was just updated
 */
function addToPreviousSettings(setting){
	// if this setting is the most recent setting
	if (previousSettings[1] == setting){
		// do nothing
		return;
	}

	// Add this setting to the list
	previousSettings.push(setting);
	// and remove old settings
	previousSettings.shift();
}

/**
 * Find the setting that can be calculated from the most recent inputs
 * @returns {String} - The name of the pace setting
 */
function findRemainingInput(){
	// Get all the pace settings keys
	return Object.keys(paceSettings)
		// Only keep the keys where
		.filter(key => {
			// the key isn't the most recent or current setting
			return !previousSettings.includes(key);
		})
		// Return the (hopefully) only element in the array
		[0];
}

/**
 * Recalculate and update a given setting
 * @param {String} setting - Setting to update
 */
function updatePaceSetting(setting){
	// If that setting doesn't exist
	if (!paceSettingUpdateFunctions.hasOwnProperty(setting)){
		// Log an error
		console.error(`${setting} is not a valid setting.`);
		// Bail
		return;
	}

	// Recalculate the setting
	paceSettingUpdateFunctions[setting]();
}

/**
 * Calculate and update the cadence setting and HTML input based on the drive time and recover time
 */
function recalculateCadence(){
	// iteration duration = drive time + recover time
	const iterationDuration = paceSettings.driveTime + paceSettings.recoverTime; // s

	// cadence = (60s / 1 min) / (duration s / 1 stroke) : stroke / min
	const cadence = round(60 / iterationDuration, 2);
	
	// If cadence is invalid
	if (cadence < 0){
		// Something went very wrong
		// Reset the input to try again
		resetInputs();
		// Throw an error
		throw new Error("Calculated invalid cadence");
	}

	// Update the pace settings object
	paceSettings.cadence = cadence;
	// Update the HTML input for cadence
	inp_cadence.value = paceSettings.cadence;
}

/**
 * Calculate and update the drive time setting and HTML input based on the cadence and recover time
 */
function recalculateDriveTime(){
	// iteration duration = (60 s / 1 min) / (cadence stroke/min) : s/stroke
	const iterationDuration = 60 / paceSettings.cadence; // s/stroke
	
	// drive time = iteration duration - recover time : s
	// Round it to 2 decimal places
	const driveTime = round(iterationDuration - paceSettings.recoverTime, 2);

	// if the drive time is invalid
	if (driveTime < 0){
		// Something went very wrong
		// Reset the input to try again
		resetInputs();
		// Throw an error
		throw new Error("Calculated invalid drive time");
	}

	// Update the pace settings object
	paceSettings.driveTime = driveTime;
	// Update the HTML input for drive time
	inp_driveTime.value =  paceSettings.driveTime;
}

/**
 * Calculate and update the recover time setting and HTML input based on the cadence and drive time
 */
function recalculateRecoverTime(){
	// iteration duration = (60 s / 1 min) / (cadence stroke/min) : s/stroke
	const iterationDuration = 60 / paceSettings.cadence; // s/stroke

	// recover time = iteration duration - drive time : s
	// Round it to 2 decimal places
	const recoverTime = round(iterationDuration - paceSettings.driveTime, 2);

	// if the recover time is invalid
	if (recoverTime < 0){
		// Something went very wrong
		// Reset the input to try again
		resetInputs();
		// Throw an error
		throw new Error("Calculated invalid recover time");
	}

	// Update the pace settings object
	paceSettings.recoverTime = recoverTime;
	// Update the HTML input for recover time
	inp_recoverTime.value =  paceSettings.recoverTime;
}

// Map each setting to its corresponding update function. This just makes it a lot easier to reference them later
const paceSettingUpdateFunctions = {
	"cadence": recalculateCadence,
	"driveTime": recalculateDriveTime,
	"recoverTime": recalculateRecoverTime
}

/********************/
/* Helper Functions */
/********************/

/**
 * Round a number to a number of decimal places
 * @param {Number} number - Number to round
 * @param {Number} decimalPlaces - How many decimal places to round it to
 * @returns 
 */
function round(number, decimalPlaces){
	// Use scientific notation to multiply by 10^n, round to the whole number, and then divide by 10^n
	return Number(Math.round(number + "e" + decimalPlaces) + "e-" + decimalPlaces)
}

/**
 * Wait for an amount of time and make sure the timeout id is recorded
 * @param {Number} ms - Wait time in milliseconds
 * @param {String} id - What id to log the timeout as
 * @returns {Promise}
 */
function wait(ms, id){
	// Reutrn a promise
	return new Promise((resolve, reject) => {
		// resolve the promise after the wait time
		// Also record the timeout id so we can clear it easily if we need to
		timeoutIDs[id] = setTimeout(resolve, ms);
	});
}

// This will make sure the inputs are cleared on startup
// Some browsers keep them filled when you refresh the page but that doesn't trigger the code to update the settings
resetInputs();