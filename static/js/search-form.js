const questions = [
  {
    question: "What type of animal are you looking for?",
    name: "type",
    options: [
      { value: "Dog", label: "Dog" },
      { value: "Cat", label: "Cat" },
      { value: "Rabbit", label: "Rabbit" },
    ]
  },
  {
    question: "What size are you looking for?",
    name: "size",
    options: [
      { value: "Small", label: "Small" },
      { value: "Medium", label: "Medium" },
      { value: "Large", label: "Large" },
    ]
  },
  {
    question: "What gender do you prefer?",
    name: "gender",
    options: [
      { value: "Male", label: "Male" },
      { value: "Female", label: "Female" },
      { value: "No preference", label: "No preference" },
    ]
  },
  // {
  //   question: "Do they have to be castrated?",
  //   name: "isCastrated",
  //   options: [
  //     { value: "Yes", label: "Yes" },
  //     { value: "No", label: "No" },
  //     { value: "No preference", label: "No preference" },
  //   ]
  // },
  // {
  //   question: "What coat do you prefer?",
  //   name: "coat",
  //   options: [
  //     { value: "Short", label: "Short" },
  //     { value: "Medium", label: "Long" },
  //     { value: "No preference", label: "No preference" },
  //   ]
  // },
  {
    question: "Do you have kids living at home?",
    name: "hasKids",
    options: [
      { value: "< 12 years old", label: "Yes, < 12 years" },
      { value: "> 12 years old", label: "Yes, > 12 years" },
      { value: "No", label: "No" },
    ]
  },
  {
    question: "Do you have one or more cats living at home?",
    name: "hasCats",
    options: [
      { value: "Yes", label: "Yes" },
      { value: "No", label: "No" },
    ]
  },
  {
    question: "Do you have one or more dogs living at home?",
    name: "hasDogs",
    options: [
      { value: "Yes", label: "Yes" },
      { value: "No", label: "No" },
    ]
  },
  // {
  //   question: "How often would the pet be alone?",
  //   name: "isAloneOften",
  //   options: [
  //     { value: "Yes", label: "Daily, a few hours a day" },
  //     { value: "No", label: "Almost never" },
  //   ]
  // },
  {
    question: "On what floor do you live?",
    name: "floor",
    options: [
      { value: "Ground-level", label: "Ground level" },
      { value: "Upperfloor with elevator", label: "Upperfloor with elevator" },
      { value: "Upperfloor without elevator", label: "Upperfloor without elevator" }
    ]
  },
  {
    question: "Do you own a garden or yard?",
    name: "hasGarden",
    options: [
      { value: "Yes", label: "Yes" },
      { value: "No", label: "No" },
    ]
  },
  // {
  //   question: "How active do you want your pet to be?",
  //   name: "activity",
  //   options: [
  //     { value: "Yes", label: "Very active" },
  //     { value: "No", label: "Not very active" },
  //     { value: "No preference", label: "No preference" },
  //   ]
  // },
  // {
  //   question: "Do you want the pet to be house trained?",
  //   name: "isHousetrained",
  //   options: [
  //     { value: "Yes", label: "Yes" },
  //     { value: "No", label: "No" },
  //     { value: "No preference", label: "No preference" },
  //   ]
  // },
  {
    question: "How important is it that the pet is comfortable with strangers?",
    name: "isComfystrangers",
    options: [
      { value: "Yes", label: "Very important" },
      { value: "No", label: "Not very important" },
    ]
  },
  // {
  //   question: "Do you want a playful pet?",
  //   name: "isPlayful",
  //   options: [
  //     { value: "Yes", label: "Very important" },
  //     { value: "No", label: "Not very important" },
  //   ]
  // },
  // {
  //   question: "Are you looking for a pair or single pet?",
  //   name: "isPaired",
  //   options: [
  //     { value: "Yes", label: "Pair" },
  //     { value: "No", label: "Single" },
  //     { value: "No preference", label: "No preference" },

  //   ]
  // },
  {
    question: "Do you have a preference for a certain age?",
    name: "age",
    options: [
      { value: "Baby", label: "Baby (0 - 1 year)" },
      { value: "Young", label: "Young (1 - 3 years)" },
      { value: "Adult", label: "Adult (3 - 7 years)" },
      { value: "Senior", label: "Senior (7+ years)" },
      { value: "No preference", label: "No preference" },

    ]
  },
];

//SEARCH FORM RESULTS //////////////////////////////////////////////////////////////////////////

const questionLabels = {
  type: 'Animal type',
  size: 'Size',
  gender: 'Gender',
  age: 'Age',
  isCastrated: 'Castrated',
  coat: 'Coat length',

  hasKids: 'Has children',
  hasCats: 'Has cats',
  hasDogs: 'Has dogs',
  isAloneOften: 'At home often',
  hasGarden: 'Has a garden',
  floor: 'Living situation',

  activity: 'Active household',
  isHousetrained: 'Needs to be housetrained',
  isComfystrangers: 'Comfortable with strangers',
  isPlayful: 'Playful',
  isPaired: 'Bonded pair',
};

module.exports = { questions, questionLabels }
