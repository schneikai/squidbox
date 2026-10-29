import visionImage from '@/utils/assets/visionImage';

// The same for every kind: what Verified means.
const VERIFIED = "Verified models passed Squidbox's own Verify.";

// What each kind of model is called and does, as its screens say it.
const modelKindText = {
  writing: {
    title: 'Writing',
    intro: 'Writes the captions and replies.',
    footer: 'The check mark is the model you write with. Thumbs up from Compare add up here.',
    verified: VERIFIED,
    useLabel: 'Write with this model',
    useFootnote: 'Only for you. Other accounts write with the defaults.',
    labelsFootnote:
      'Every account sees these labels. Accounts without model choice write with the Default, or with the Uncensored default when their persona has Adult content on.',
    pickIntro: 'Pick 2 or more models. Each one writes posts for the same prompt.',
  },
  vision: {
    title: 'Vision',
    intro: 'Tags your photos and videos.',
    footer:
      'The check mark is the model you tag with. The count is every tag you tapped as fitting in Compare. They add up like thumbs up.',
    verified: VERIFIED,
    useLabel: 'Tag with this model',
    useFootnote: 'Only for you. Other accounts tag with the defaults.',
    labelsFootnote:
      'Every account sees these labels. Accounts without model choice tag with the Default, or with the Uncensored default when their persona has Adult content on.',
    note: `Each photo goes to the model as a JPEG ${visionImage.longSide} px on its longer side, at quality ${Math.round(visionImage.quality * 100)}.`,
    pickIntro: 'Pick the photos and 2 or more models. Each model tags the same photos.',
  },
};

export default modelKindText;
