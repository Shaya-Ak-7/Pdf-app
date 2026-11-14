import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AppFile } from '../types';
import type { AppTheme } from '../theme';

type Props = {
  file: AppFile;
  theme: AppTheme;
};

/** Web preview: native <video>/<audio> elements give full Drive-like playback. */
export function MediaPreview({ file, theme }: Props) {
  const isVideo = file.kind === 'video';
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}> 
      {React.createElement(isVideo ? 'video' : 'audio', {
        src: file.uri,
        controls: true,
        style: isVideo
          ? { width: '100%', height: '100%', background: '#000' }
          : { width: '100%', maxWidth: 520 },
      })}
      <Text numberOfLines={1} style={[styles.caption, { color: theme.colors.muted }]}>{file.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  caption: {
    fontSize: 13,
    paddingHorizontal: 16,
  },
});
