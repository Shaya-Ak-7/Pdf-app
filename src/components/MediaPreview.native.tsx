import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAudioPlayer } from 'expo-audio';

import type { AppFile } from '../types';
import type { AppTheme } from '../theme';

type Props = {
  file: AppFile;
  theme: AppTheme;
};

function VideoSurface({ file, theme }: Props) {
  const player = useVideoPlayer(file.uri);
  return (
    <View style={[styles.root, { backgroundColor: '#000' }]}> 
      <VideoView style={styles.video} player={player} nativeControls contentFit="contain" />
      <View style={[styles.caption, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface }]}> 
        <Text numberOfLines={1} style={[styles.captionText, { color: theme.colors.muted }]}>
          {file.name}
        </Text>
      </View>
    </View>
  );
}

function AudioSurface({ file, theme }: Props) {
  const player = useAudioPlayer(file.uri);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (playing) {
      player.pause();
      setPlaying(false);
    } else {
      player.play();
      setPlaying(true);
    }
  };

  const duration = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 0;
  const secs = Math.floor(duration % 60).toString().padStart(2, '0');
  const mins = Math.floor(duration / 60);

  return (
    <View style={[styles.root, styles.audioCenter, { backgroundColor: theme.colors.background }]}> 
      <View style={[styles.audioCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
        <Text style={[styles.audioGlyph, { color: theme.colors.faint }]}>♪</Text>
        <Text numberOfLines={2} style={[styles.audioTitle, { color: theme.colors.text }]}>{file.name}</Text>
        {duration ? <Text style={[styles.audioMeta, { color: theme.colors.muted }]}>{mins}:{secs}</Text> : null}
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: pressed ? theme.colors.accentSoft : theme.colors.surfaceMuted, borderColor: theme.colors.border },
          ]}
        >
          <Text style={[styles.playLabel, { color: theme.colors.text }]}>{playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function MediaPreview(props: Props) {
  return props.file.kind === 'video' ? <VideoSurface {...props} /> : <AudioSurface {...props} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 320,
  },
  video: {
    flex: 1,
  },
  caption: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  captionText: {
    fontSize: 13,
  },
  audioCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  audioCard: {
    width: '100%',
    maxWidth: 340,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  audioGlyph: {
    fontSize: 46,
  },
  audioTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  audioMeta: {
    fontSize: 13,
  },
  playButton: {
    marginTop: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    paddingHorizontal: 30,
    paddingVertical: 10,
  },
  playLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
});
