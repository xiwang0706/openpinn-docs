自适应激活函数
==============

.. openpinn-method-summary:: adaptive_activation adaptive_tanh

这是什么
----------

普通 PINN 每层使用固定的 ``tanh(z)``。这里改为 ``tanh(a z)``，其中
``a`` 是训练中一起学习的正斜率；每个隐藏层只增加一个标量参数。
目标是让网络自己调整非线性的尺度，而不是保证每个问题都更准。

放在哪里
----------

* 实现：``src/openpinn/models.py`` 中的 ``AdaptiveTanh``；
* 统一调用：配置 ``model.activation: adaptive_tanh``；
* 对比入口：``examples/burgers_adaptive_activation.py``；
* 固定配置：``configs/reference_runs/burgers_adaptive_activation.yaml``。

依据与许可
----------

* 核心论文：Jagtap, Kawaguchi and Karniadakis, *Adaptive activation
  functions accelerate convergence in deep and physics-informed neural
  networks*, Journal of Computational Physics 404 (2020) 109136，DOI
  ``10.1016/j.jcp.2019.109136``。
* 参考仓库：``https://github.com/AmeyaJagtap/Adaptive_Activation_Functions``。
* 许可：MIT。本项目按论文公式独立编写 PyTorch 版，没有复制该
  TensorFlow 代码。

最短调用
--------

.. code-block:: python

   import openpinn as op
   result = op.solve(
       "burgers", method="adaptive_activation", variant="adaptive_tanh", steps=5000
   )

怎么跑
------

.. code-block:: bash

   PYTHONPATH=src python -m examples.burgers_adaptive_activation \
     --output-dir runs/burgers_adaptive_activation_<timestamp>

公平对比
--------

两组共用同一个 Burgers 问题、随机种子、采样点数、网络宽深、损失权重、
Adam 学习率和 1500 个训练步。唯一主动变更是 ``tanh`` 换为
``adaptive_tanh``。因此改进组会多 4 个可训练标量，这是方法本身必需的差异。

参考实验结果
------------

2026-08-26 在 CPU 上使用固定随机种子完成 1500 步对比。两组训练都完成，
保存的数值和 SVG 图都通过有限值/结构检查。Cole–Hopf 参考解只用于训练后评价。

.. list-table::
   :header-rows: 1

   * - 方法
     - 相对 L2
     - 最大绝对误差
     - PDE 残差 RMSE
     - 边界 RMSE
     - 初值 RMSE
     - 训练时间
   * - 固定 tanh
     - 0.40998
     - 0.93943
     - 0.22334
     - 0.03762
     - 0.22689
     - 5.289 s
   * - 自适应 tanh
     - 0.40835
     - 1.08818
     - 0.22629
     - 0.02885
     - 0.21556
     - 7.148 s

.. image:: /_static/methods/adaptive_activation.svg
   :alt: Burgers 普通 tanh 与自适应 tanh 的四时间片、误差和损失对比
   :width: 100%

完整结果位于 ``results/methods/burgers_adaptive_activation_reference_20260826/``。自适应组的
相对 L2、RMSE、边界和初值误差略低，但最大局部误差从 0.93943 升到
1.08818，PDE 残差略高，用时增加约 35%。四层学到的斜率约为
1.089、1.111、1.181 和 1.183，证明新参数确实参与了训练。这是混合结果，
不声称方法整体更优。

限制和失败记录
--------------

* 当前是“每个隐藏层一个斜率”的最小变体，没有同时加入其他加速技巧。
* 只做一个固定种子的短比较，不能声称统计上更优。
* 冲击附近的最大局部误差反而更高，不能只看总体相对 L2。
* 若任一组失败，异常会写入比较目录的 ``failure.json`` 和
  ``failure_notes.md``。
