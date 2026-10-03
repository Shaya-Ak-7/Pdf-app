import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { AppFile } from '../types';
import type { AppTheme } from '../theme';

type Props = {
  file: AppFile;
  theme: AppTheme;
};

export function PdfPreview({ file, theme }: Props) {
  return (
    <View style={[styles.shell, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}> 
      <View style={[styles.toolbar, { borderBottomColor: theme.colors.border }]}> 
        <Text style={[styles.toolbarText, { color: theme.colors.text }]}>PDF preview</Text>
        <Text style={[styles.toolbarText, { color: theme.colors.muted }]}>Web preview</Text>
      </View>
      <View style={styles.frameWrap}>
        {React.createElement('iframe', {
          title: file.name,
          src: file.uri,
          style: { border: '0', width: '100%', height: '100%', background: '#fff' },
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    height: 560,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: 'hidden',
  },
  toolbar: {
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toolbarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  frameWrap: {
    flex: 1,
  },
});
