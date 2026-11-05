import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Card from '@/components/Card';
import Divider from '@/components/Divider';
import Icon from '@/components/Icon';
import ContactAvatar from '@/features/contact-avatar/ContactAvatar';
import { colors, layout, press, scale, sizes, typography } from '@/styles/designTokens';
import listTextStyles from '@/styles/listTextStyles';
import pluralizeText from '@/utils/pluralizeText';

const STACK_SIZE = scale(32);
const OVERLAP = -scale(10);

/**
 * The contact lists (contactListQuery's rows) in one card: each list's name and count, the
 * avatars of its first members overlapping with "+N" for the rest, opening the list.
 */
export default function ContactListRows({ lists }) {
  return (
    <Card>
      {lists.map((list, index) => (
        <View key={list.id}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && press.flat]}
            onPress={() => router.navigate(`/contact-list/${list.id}`)}
            accessibilityRole="button"
          >
            <View style={styles.labels}>
              <Text style={styles.name} numberOfLines={1}>
                {list.name}
              </Text>
              <Text style={listTextStyles.subtitle}>
                {pluralizeText('1 contact', '%{count} contacts', list.memberCount)}
              </Text>
            </View>
            <View style={styles.stack}>
              {list.firstMembers.map((member, i) => (
                <ContactAvatar
                  key={member.id}
                  contact={member}
                  size="small"
                  isStacked
                  style={i > 0 && styles.overlapped}
                />
              ))}
              {list.memberCount > list.firstMembers.length && (
                <MoreDisc count={list.memberCount - list.firstMembers.length} />
              )}
            </View>
            <Icon name="chevron-right" size={sizes.iconSmall} color={colors.text.tertiary} />
          </Pressable>
          {index < lists.length - 1 && <Divider />}
        </View>
      ))}
    </Card>
  );
}

// "+N", the members the stack leaves out.
function MoreDisc({ count }) {
  return (
    <View style={[styles.more, styles.overlapped]}>
      <Text style={styles.moreText}>+{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: layout.sideGutter,
    paddingVertical: 12,
  },
  labels: {
    flex: 1,
  },
  name: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text.primary,
  },
  stack: {
    flexDirection: 'row',
  },
  overlapped: {
    marginLeft: OVERLAP,
  },
  more: {
    width: STACK_SIZE,
    height: STACK_SIZE,
    borderRadius: STACK_SIZE / 2,
    borderWidth: 2,
    borderColor: colors.background.surface,
    backgroundColor: colors.background.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    fontSize: typography.caption,
    fontWeight: '600',
    color: colors.text.secondary,
  },
});
