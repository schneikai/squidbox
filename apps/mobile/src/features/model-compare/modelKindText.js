import visionImage from '@/utils/assets/visionImage';

// Under a model's label switches: Default and Uncensored default are this account's picks.
const LABELS_FOOTNOTE = 'Default and Uncensored default are only for you until you apply the changes for everyone.';

// What each kind of model is called and does, as its screens say it.
const modelKindText = {
  writing: {
    title: 'Writing',
    intro: 'Writes the captions and replies.',
    footer: 'Thumbs up from Compare add up here.',
    labelsFootnote: LABELS_FOOTNOTE,
    everyAccountUses: 'Every account writes with',
    pickIntro: 'Pick 2 or more models. Each one writes posts for the same prompt.',
  },
  vision: {
    title: 'Vision',
    intro: 'Tags your photos and videos.',
    footer: 'The count is every tag you tapped as fitting in Compare. They add up like thumbs up.',
    labelsFootnote: LABELS_FOOTNOTE,
    everyAccountUses: 'Every account tags with',
    note: `Each photo goes to the model as a JPEG ${visionImage.longSide} px on its longer side, at quality ${Math.round(visionImage.quality * 100)}.`,
    pickIntro: 'Pick the photos and 2 or more models. Each model tags the same photos.',
  },
};

export default modelKindText;
