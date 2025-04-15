import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { useAtom } from 'jotai';
import { replyingToCommentAtom } from '../../atoms/commentAtoms';
import { useCommentActions } from '../../hooks/useCommentActions';

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
  };
  
  return (
    <View className="w-full pl-4 pr-2 bg-[#f3f4f6] rounded-lg flex flex-row items-center">
      <TextInput
        ref={inputRef}
        className="flex-1 h-11 text-base text-zinc-500 font-normal"
        placeholder="Message"
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={1000}
      />
      
      <View className="flex flex-row items-center gap-4">
        <TouchableOpacity>
          <View className="w-6 h-6 bg-gray-400 rounded" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={handleSubmit} 
          disabled={!content.trim()}
        >
          <View className={`w-6 h-6 rounded ${!content.trim() ? 'bg-gray-400' : 'bg-black'}`} />
        </TouchableOpacity>
      </View>
    </View>
  );
};