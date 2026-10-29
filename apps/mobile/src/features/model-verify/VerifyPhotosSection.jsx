import VerifyPhotoRow from './VerifyPhotoRow';
import useVerifyPhotos from './useVerifyPhotos';

import ScreenSectionHeader from '@/components/ScreenSectionHeader';
import { Section, SectionFooter } from '@/components/settings-list/SettingsList';

/** A vision Verify's photos, one row per photo of its `plan` with its tags or what went wrong. */
export default function VerifyPhotosSection({ run, plan }) {
  const { photos } = useVerifyPhotos();
  const [planSection] = plan.sections;
  const turns = run.result?.sections.find((section) => section.id === planSection.id)?.turns ?? [];

  return (
    <>
      <ScreenSectionHeader title="Photos" />
      <Section>
        {planSection.prompts.map((file, index) => (
          <VerifyPhotoRow
            key={file}
            uri={photos?.[file] ?? null}
            turn={turns[index] ?? null}
            isRunning={run.status === 'running' && index === turns.length}
          />
        ))}
      </Section>
      <SectionFooter>
        A photo that comes back with no tags, broken JSON or a refusal shows here as Missed, with what the model said.
      </SectionFooter>
    </>
  );
}
