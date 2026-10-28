import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { AppFile } from '../types';
import type { AppTheme } from '../theme';

type Props = {
  file: AppFile;
  theme: AppTheme;
};

/** Web preview uses the browser's own full-height PDF viewer (Drive-like chrome). */
export function PdfPreview({ file, theme }: Props) {
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}> 
      {React.createElement('iframe', {
        title: file.name,
        src: file.uri,
        style: { border: '0', width: '100%', height: '100%', background: '#fff' },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 320,
  },
});
