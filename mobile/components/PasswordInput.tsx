import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C } from '../lib/theme';

type Props = Omit<TextInputProps, 'secureTextEntry' | 'style'> & {
  style?: StyleProp<TextStyle>;
};

/** Password field with a show/hide (eye) toggle. */
export default function PasswordInput({ style, ...rest }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.wrap}>
      <TextInput
        {...rest}
        style={[style, styles.input]}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        style={styles.eye}
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <MaterialCommunityIcons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color={C.onSurfaceVariant}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  input: { paddingRight: 46 },
  eye: { position: 'absolute', right: 12, height: '100%', justifyContent: 'center' },
});
