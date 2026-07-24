alter table public.adaptive_live_model_weights
  drop constraint if exists adaptive_live_model_weights_method_check;

alter table public.adaptive_live_model_weights
  add constraint adaptive_live_model_weights_method_check
  check (
    method in (
      'delta',
      'motif',
      'cycle',
      'cross',
      'joint_pair',
      'momentum_decay',
      'transition_matrix',
      'bayesian_change_point',
      'adaptive_contextual_fusion',
      'regime_adaptive',
      'consensus',
      'walk_forward_weighted'
    )
  );

comment on constraint adaptive_live_model_weights_method_check
  on public.adaptive_live_model_weights is
  'Allows every active Adaptive Movement method, including Bayesian Adaptive Memory and Adaptive Contextual Fusion.';
