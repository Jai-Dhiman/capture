import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity, Keyboard } from 'react-native';
import { useAtom } from 'jotai';
import { replyingToCommentAtom } from '../../atoms/commentAtoms';
import { useCommentActions } from '../../hooks/useCommentActions';
import SendCommentIcon from "../../../assets/icons/SendCommentIcon.svg";

export const CommentInput = () => {
  const [content, setContent] = useState('');
  const [replyingTo] = useAtom(replyingToCommentAtom);
  const { createComment, cancelReply } = useCommentActions();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    await createComment(content);
    setContent('');
    Keyboard.dismiss();
  };

  return (
    <View className="w-full pl-4 pr-2 pb-2 bg-[#f3f4f6] rounded-lg flex flex-row items-center">
      <TextInput
        ref={inputRef}
        className="flex-1 h-11 text-base text-zinc-500 font-normal pt-2 pb-2"
        placeholder={replyingTo ? "Reply to comment..." : "Add a comment..."}
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={1000}
      />

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={!content.trim()}
        style={{ opacity: content.trim() ? 1 : 0.5 }}
      >
        <SendCommentIcon width={24} height={24} />
      </TouchableOpacity>
    </View>
  );
};