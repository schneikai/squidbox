import visionImage from '@/utils/assets/visionImage';

// What each kind of model is called and does, as its screens say it.
const modelKindText = {
  writing: {
    title: 'Writing',
    intro: 'Writes the captions and replies.',
    footer: 'Thumbs up from Compare add up here.',
    pickIntro: 'Pick 2 or more models. Each one writes posts for the same prompt.',
  },
  vision: {
    title: 'Vision',
    intro: 'Looks at your photos and tags what it sees, so the assistant knows what they show.',
    footer: 'The count is every tag you tapped as fitting in Compare. They add up like thumbs up.',
    note: `Each photo goes to the model as a JPEG ${visionImage.longSide} px on its longer side, at quality ${Math.round(visionImage.quality * 100)}.`,
    pickIntro: 'Pick the photos and 2 or more models. Each model tags the same photos.',
  },
};

export default modelKindText;
