import visionImage from '@/utils/assets/visionImage';

// The same for every kind: what Verified means.
const VERIFIED = "Verified models passed Squidbox's own Verify.";
// Under a model's label switches: Default and Uncensored default are this account's picks.
const LABELS_FOOTNOTE = 'Default and Uncensored default are only for you until you make them the default for everyone.';

// What each kind of model is called and does, as its screens say it.
const modelKindText = {
  writing: {
    title: 'Writing',
    intro: 'Writes the captions and replies.',
    footer: 'The check mark is the model you write with. Thumbs up from Compare add up here.',
    verified: VERIFIED,
    labelsFootnote: LABELS_FOOTNOTE,
    everyoneUses: 'Everyone writes with',
    everyAccountUses: 'Every account writes with',
    pickIntro: 'Pick 2 or more models. Each one writes posts for the same prompt.',
  },
  vision: {
    title: 'Vision',
    intro: 'Tags your photos and videos.',
    footer:
      'The check mark is the model you tag with. The count is every tag you tapped as fitting in Compare. They add up like thumbs up.',
    verified: VERIFIED,
    labelsFootnote: LABELS_FOOTNOTE,
    everyoneUses: 'Everyone tags with',
    everyAccountUses: 'Every account tags with',
    note: `Each photo goes to the model as a JPEG ${visionImage.longSide} px on its longer side, at quality ${Math.round(visionImage.quality * 100)}.`,
    pickIntro: 'Pick the photos and 2 or more models. Each model tags the same photos.',
  },
};

export default modelKindText;
