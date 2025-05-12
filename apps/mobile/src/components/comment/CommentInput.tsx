import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Keyboard, Text, StyleSheet } from 'react-native';
import { useAtom } from 'jotai';
import { replyingToCommentAtom } from '../../atoms/commentAtoms';
import { useCommentActions } from '../../hooks/useCommentActions';
import SendCommentIcon from "../../../assets/icons/SendCommentIcon.svg";

export const CommentInput = () => {
  const [content, setContent] = useState('');
  const [replyingTo] = useAtom(replyingToCommentAtom);
  const { createComment } = useCommentActions();
  const inputRef = useRef<TextInput>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
      setContent('');
    }
  }, [replyingTo]);

  // Reset content when canceling a reply
  useEffect(() => {
    if (!replyingTo) {
      setContent('');
    }
  }, [replyingTo]);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    await createComment(content.trim());
    setContent('');
    Keyboard.dismiss();
  };

  return (
    <View
      className={`w-full px-4 py-2 bg-[#f3f4f6] rounded-lg ${isFocused ? 'border-2 border-[#E4CAC7]' : 'border-2 border-transparent'}`}
    >
      {replyingTo?.username && (
        <View style={styles.replyContainer}>
          <Text style={styles.replyingText}>Replying to</Text>
          <View style={styles.usernameContainer}>
            <Text style={styles.usernameText}>@{replyingTo.username}</Text>
          </View>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.textInput}
          placeholder={replyingTo ? "Add your reply..." : "Add a comment..."}
          value={content}
          onChangeText={setContent}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          multiline
          maxLength={1000}
          textAlignVertical="top"
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!content.trim()}
          style={[styles.sendButton, { opacity: content.trim() ? 1 : 0.5 }]}
        >
          <SendCommentIcon width={24} height={24} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  replyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  replyingText: {
    fontSize: 14,
    marginRight: 6,
    color: '#6b7280',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    minHeight: 30,
    paddingTop: 0,
    paddingBottom: 4,
    paddingHorizontal: 0,
    fontSize: 16,
    lineHeight: 20,
    color: '#6b7280',
    textAlignVertical: 'top',
    marginRight: 8,
  },
  usernameContainer: {
    backgroundColor: '#e4cac7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  usernameText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4b5563',
  },
  sendButton: {
    marginBottom: 4,
  }
});