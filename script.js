'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration, date) {
    // this.date = ...
    // this.id = ...
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.date = date;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const date = new Date(this.date);

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} ${
      this.distance
    } km on ${
      months[date.getMonth()]
    } ${date.getDate()} ${date.getHours()}:${date.getMinutes()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, date, cadence) {
    super(coords, distance, duration, date);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, date, elevationGain) {
    super(coords, distance, duration, date);
    this.elevationGain = elevationGain;
    // this.type = 'cycling';
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

///////////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const removeAllBtn = document.querySelector('.control__btns--removeAll');
const showSortBox = document.querySelector('.control__btns--sort');
const sortBox = document.querySelector('.sort__box');
const sortBtns = document.querySelectorAll('.sort__btn');
const messageBox = document.querySelector('.confirmation__box');
const messageYesBtn = document.querySelector('.msg__btn--yes');
const messageNoBtn = document.querySelector('.msg__btn--no');
const validationBox = document.querySelector('.validation__box');
const validationBtn = document.querySelector('.validation__btn');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
    containerWorkouts.addEventListener('click', this._removeWorkout.bind(this));
    validationBtn.addEventListener('click', this._hideValidationBox.bind(this));
    removeAllBtn.addEventListener('click', this._showMessageBox);
    messageNoBtn.addEventListener('click', this._hideMessageBox);
    messageYesBtn.addEventListener('click', this._removeAllWorkouts);
    containerWorkouts.addEventListener('click', this._editWorkout.bind(this));
    showSortBox.addEventListener('click', this._toggleSortBox.bind(this));
    sortBox.addEventListener('click', this._sortWorkouts.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    // console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _clearInputsFields() {
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
  }

  _hideForm() {
    this._clearInputsFields();
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);

    // reload page after submit form
    location.reload();
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _showValidationBox() {
    validationBox.classList.remove('validation__box--hidden');
  }

  _hideValidationBox() {
    validationBox.classList.add('validation__box--hidden');
    this._clearInputsFields();
  }

  _toggleSortBox() {
    sortBox.classList.toggle('sort__box--hidden');
  }

  _newWorkout(e) {
    const isNumber = (...inputs) => inputs.every(inp => Number.isFinite(inp));
    const isPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;
    const date = Date.now(); // number in miliseconds. This way we can easily restore date object later(when it converts back from JSON upon storage load) and use its methods

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        !isNumber(distance, duration, cadence) ||
        !isPositive(distance, duration, cadence)
      )
        // return alert('Inputs have to be positive numbers!');
        return this._showValidationBox();

      workout = new Running([lat, lng], distance, duration, date, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !isNumber(distance, duration, elevation) ||
        !isPositive(distance, duration)
      )
        // return alert('Inputs have to be positive numbers!');
        return this._showValidationBox();

      workout = new Cycling([lat, lng], distance, duration, date, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  _removeWorkout(e) {
    const removeButton = e.target.closest('.workout__delete--btn');
    if (!removeButton) return;

    const workoutItem = removeButton.closest('.workout');
    const workoutId = workoutItem.dataset.id;

    const findWorkout = this.#workouts.find(work => work.id === workoutId);
    const workoutIndex = this.#workouts.indexOf(findWorkout);

    // Remove workout from the list
    workoutItem.remove();

    // Remove workout from the #workouts array
    this.#workouts = this.#workouts.filter(workout => workout.id !== workoutId);

    // Remove marker from map
    this.#markers[workoutIndex].remove();

    // Remove marker from the #markers array
    this.#markers.splice(workoutIndex, 1);

    // Update local storage
    this._setLocalStorage();
  }

  _removeAllWorkouts() {
    localStorage.clear();
    location.reload();
  }

  _showMessageBox() {
    messageBox.classList.remove('confirmation__box--hidden');
  }

  _hideMessageBox() {
    messageBox.classList.add('confirmation__box--hidden');
  }

  _editWorkout(e) {
    const editButton = e.target.closest('.workout__edit--btn');

    if (!editButton) return;

    const workoutItem = editButton.closest('.workout');
    const workoutId = workoutItem.dataset.id;

    const findWorkout = this.#workouts.find(work => work.id === workoutId);
    const workoutIndex = this.#workouts.indexOf(findWorkout);

    // CONVERT WORKOUT COORDS ARRAY TO OBJECT TO FIT MAP EVENT FORMAT
    const coords = findWorkout.coords;
    const objCoords = {
      latlng: {
        lat: coords[0],
        lng: coords[1],
      },
    };

    this._showForm(objCoords);

    inputType.value = findWorkout.type;
    inputDistance.value = findWorkout.distance;
    inputDuration.value = findWorkout.duration;

    if (inputType.value === 'running') {
      inputCadence.value = findWorkout.cadence;
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
    }

    if (inputType.value === 'cycling') {
      inputElevation.value = findWorkout.elevationGain;
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
    }

    // remove from array
    this.#workouts.splice(workoutIndex, 1);

    // remove from marker array
    this.#markers.splice(workoutIndex, 1);
  }

  _sortWorkouts(e) {
    const clicked = e.target.closest('.sort__btn');
    // Guard clause
    if (!clicked) return;
    let currentDirection = 'descending';
    const arrow = clicked.querySelector('.arrow');
    const type = clicked.dataset.type;

    // Remove active classes
    sortBtns.forEach(btn => btn.classList.remove('sort__btn--active'));

    // Activate filter
    clicked.classList.add('sort__btn--active');

    // set all arrows to default state (down)
    sortBox
      .querySelectorAll('.arrow')
      .forEach(e => e.classList.remove('arrow__up'));

    const typeValues = this.#workouts.map(workout => {
      return workout[type];
    });

    const sortedAscending = typeValues
      .slice()
      .sort(function (a, b) {
        return a - b;
      })
      .join('');
    const sortedDescending = typeValues
      .slice()
      .sort(function (a, b) {
        return b - a;
      })
      .join('');

    // compare sortedAscending array with values from #workout array to check how are they sorted
    // 1. case 1 ascending
    if (typeValues.join('') === sortedAscending) {
      currentDirection = 'ascending';
      arrow.classList.add('arrow__up');
    }
    // 2. case 2 descending
    if (typeValues.join('') === sortedDescending) {
      currentDirection = 'descending';
      arrow.classList.remove('arrow__up');
    }

    // sort main workouts array
    this._sortArray(this.#workouts, currentDirection, type);

    // clear rendered workouts from DOM
    containerWorkouts
      .querySelectorAll('.workout')
      .forEach(workout => workout.remove());
    // clear workouts from map(to prevent bug in array order when deleting a single workout)
    this.#markers.forEach(marker => marker.remove());
    //clear array
    this.#markers = [];
    // render list all again sorted
    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
      // create new markers and render them on map
      this._renderWorkoutMarker(workout);
    });
  }

  _sortArray(array, currentDirection, type) {
    // sort opposite to the currentDirection
    if (currentDirection === 'ascending') {
      array.sort(function (a, b) {
        return b[type] - a[type];
      });
    }
    if (currentDirection === 'descending') {
      array.sort(function (a, b) {
        return a[type] - b[type];
      });
    }
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();

    // marker.options.workoutId = workout.id;

    // put the marker inside markers array
    this.#markers.push(marker);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
        <div class="workout__btns--container">
        <button class="workout__btns">
          <span class="material-symbols-outlined workout__edit--btn">tune</span>
        <button class="workout__btns">
          <span class="material-symbols-outlined workout__delete--btn">delete_forever</span>
        </button>
      </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🏔️</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
        <div class="workout__btns--container">
          <button class="workout__btns">
            <span class="material-symbols-outlined workout__edit--btn">tune</span>
          <button class="workout__btns">
            <span class="material-symbols-outlined workout__delete--btn">delete_forever</span>
          </button>
        </div>
      </li>
      `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    // BUGFIX: When we click on a workout before the map has loaded, we get an error. But there is an easy fix:
    if (!this.#map) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }
}

const app = new App();
