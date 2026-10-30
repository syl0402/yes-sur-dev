// ys-143 글 내용 수정 · F-603 (본문만. 질문·보기는 투표가 있어서 못 바꿈)
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { formStyles } from "@/components/create/formStyles";
import PrimaryButton from "@/components/PrimaryButton";
import { colors, spacing } from "@/constants/theme";
import { POST_BODY_MAX, type Post } from "@/lib/community";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export default function EditPost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.rpc("get_post", { p_post_id: Number(id) }).then(({ data, error: loadError }) => {
      if (loadError) {
        setError(errorMessage(loadError));
        return;
      }
      const p = data as Post;
      setPost(p);
      setBody(p.body ?? "");
    });
  }, [id]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    const { error: saveError } = await supabase.rpc("update_post_body", {
      p_post_id: Number(id),
      p_body: body.trim() || undefined,
    });
    setSaving(false);
    if (saveError) {
      setError(errorMessage(saveError));
      return;
    }
    router.back();
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: "내용 수정" }} />

      {post === null ? (
        error ? <Text style={formStyles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.form}>
          <Text style={formStyles.label}>{post.question}</Text>
          <Text style={formStyles.hint}>질문과 보기는 투표가 있어서 바꿀 수 없어요. 내용만 고칠 수 있어요.</Text>
          <TextInput
            style={[formStyles.input, formStyles.multiline]}
            value={body}
            onChangeText={setBody}
            placeholder="상황이나 이유를 덧붙여 주세요"
            maxLength={POST_BODY_MAX}
            multiline
          />
          {error !== "" && <Text style={formStyles.error}>{error}</Text>}
          <PrimaryButton title="저장" onPress={save} loading={saving} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
  },
  form: {
    gap: spacing.md,
  },
});
